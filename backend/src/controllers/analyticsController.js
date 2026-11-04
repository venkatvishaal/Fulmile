const { Vehicle, Driver, Trip, FuelLog, Expense, MaintenanceLog, FreightBooking } = require('../models');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

const analyticsController = {
  getDashboard: async (req, res) => {
    try {
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const carrierFilter = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };

      // Vehicle counts
      const vehicleCounts = await Vehicle.findAll({
        where: carrierFilter,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      const vehicleStats = { total: 0, Available: 0, 'On Trip': 0, 'In Shop': 0, Retired: 0 };
      vehicleCounts.forEach(v => {
        const status = v.getDataValue('status');
        const count = parseInt(v.getDataValue('count'));
        vehicleStats[status] = count;
        vehicleStats.total += count;
      });

      // Driver counts
      const driverCounts = await Driver.findAll({
        where: carrierFilter,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      const driverStats = { total: 0, Available: 0, 'On Trip': 0, 'Off Duty': 0, Suspended: 0 };
      driverCounts.forEach(d => {
        const status = d.getDataValue('status');
        const count = parseInt(d.getDataValue('count'));
        driverStats[status] = count;
        driverStats.total += count;
      });

      // Trip counts
      const tripCounts = await Trip.findAll({
        where: carrierFilter,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status']
      });

      const tripStats = { total: 0, Draft: 0, Dispatched: 0, Completed: 0, Cancelled: 0 };
      tripCounts.forEach(t => {
        const status = t.getDataValue('status');
        const count = parseInt(t.getDataValue('count'));
        tripStats[status] = count;
        tripStats.total += count;
      });

      // Fleet utilization %
      const activeFleet = vehicleStats.total - vehicleStats.Retired;
      const utilization = activeFleet > 0 ? Math.round(((vehicleStats['On Trip']) / activeFleet) * 100) : 0;

      // Fuel efficiency (top 5 vehicles by distance/fuel)
      const fuelEfficiency = await Trip.findAll({
        attributes: [
          'vehicle_id',
          [sequelize.fn('SUM', sequelize.col('planned_distance')), 'total_distance'],
          [sequelize.fn('SUM', sequelize.col('fuel_consumed_liters')), 'total_fuel']
        ],
        where: {
          status: 'Completed',
          fuel_consumed_liters: { [Op.gt]: 0 },
          ...carrierFilter
        },
        group: ['Trip.vehicle_id', 'vehicle.id', 'vehicle.registration_number', 'vehicle.model_name'],
        include: [{ model: Vehicle, as: 'vehicle', attributes: ['registration_number', 'model_name'] }],
        order: [[sequelize.literal('SUM("planned_distance") / NULLIF(SUM("fuel_consumed_liters"), 0)'), 'DESC']],
        limit: 10,
        raw: false
      });

      // Operational costs per vehicle (scoped to carrier's vehicles)
      let opCosts = [];
      try {
        let opCostsQuery = `SELECT voc.* FROM vehicle_operational_costs voc JOIN vehicles v ON voc.vehicle_id = v.id`;
        const replacements = {};
        if (req.user?.role !== 'admin' || req.user?.carrierId) {
          opCostsQuery += ` WHERE v.carrier_id = :carrierId`;
          replacements.carrierId = carrierId;
        }
        opCostsQuery += ` ORDER BY voc.total_operational_cost DESC`;
        opCosts = await sequelize.query(opCostsQuery, { replacements, type: sequelize.QueryTypes.SELECT });
      } catch (e) {
        opCosts = [];
      }

      // Open maintenance count
      const openMaintenance = await MaintenanceLog.count({
        include: [{
          model: Vehicle,
          as: 'vehicle',
          where: carrierFilter,
          attributes: []
        }],
        where: { status: 'open' }
      });

      // Shared Cargo Analytics & Pure Profit Calculation
      // (100% Margin revenue: incremental payload on existing running corridors with 0 additional base fuel/driver cost)
      const sharedBookings = await FreightBooking.findAll({
        where: {
          carrier_id: carrierId,
          price_quote: { [Op.gt]: 0 },
          status: { [Op.in]: ['Accepted', 'In Transit', 'Delivered'] }
        },
        include: [{ model: Trip, as: 'trip', attributes: ['id', 'vehicle_id', 'status'] }]
      });

      let totalSharedCargoProfit = 0;
      const vehicleSharedProfitMap = {};
      let sharedInTransitCount = 0;
      let sharedDeliveredCount = 0;

      for (const sb of sharedBookings) {
        const amt = parseFloat(sb.price_quote) || 0;
        totalSharedCargoProfit += amt;
        if (sb.status === 'In Transit') sharedInTransitCount++;
        if (sb.status === 'Delivered') sharedDeliveredCount++;

        const vId = sb.trip?.vehicle_id;
        if (vId) {
          vehicleSharedProfitMap[vId] = (vehicleSharedProfitMap[vId] || 0) + amt;
        }
      }

      // ── COMPLETED TRIPS FINANCIAL SETTLEMENT & RECONCILIATION ──
      const completedTrips = await Trip.findAll({
        where: {
          ...carrierFilter,
          status: 'Completed'
        },
        include: [
          { model: Vehicle, as: 'vehicle', attributes: ['id', 'registration_number', 'model_name'] },
          { model: Driver, as: 'driver', attributes: ['id', 'name'] },
          { model: FuelLog, as: 'fuel_logs', attributes: ['id', 'liters', 'cost', 'date'] },
          {
            model: FreightBooking,
            as: 'freight_bookings',
            attributes: ['id', 'shipment_id', 'is_shared', 'price_quote', 'cargo_weight', 'status', 'pickup_address', 'delivery_address']
          }
        ],
        order: [['completed_at', 'DESC']]
      });

      let totalGrossRevenue = 0;
      let totalFreightRevenue = 0;
      let totalCompletedSharedRevenue = 0;
      let totalFuelCost = 0;

      const completedTripsFinancials = completedTrips.map(t => {
        const bookings = t.freight_bookings || [];

        let primaryRev = 0;
        let sharedRev = 0;
        let sharedCount = 0;

        bookings.forEach(b => {
          const amt = parseFloat(b.price_quote) || 0;
          if (b.is_shared) {
            sharedRev += amt;
            sharedCount++;
          } else {
            primaryRev += amt;
          }
        });

        // Fallback to trip's price_quote if primary booking was not linked in freight_bookings
        if (primaryRev === 0 && parseFloat(t.price_quote) > 0) {
          primaryRev = parseFloat(t.price_quote);
        }

        const totalRev = primaryRev + sharedRev;

        // Fuel cost from logged fuel_logs or fuel_consumed_liters * 100
        let tripFuelCost = 0;
        if (t.fuel_logs && t.fuel_logs.length > 0) {
          tripFuelCost = t.fuel_logs.reduce((sum, fl) => sum + (parseFloat(fl.cost) || 0), 0);
        } else if (parseFloat(t.fuel_consumed_liters) > 0) {
          tripFuelCost = parseFloat(t.fuel_consumed_liters) * 100;
        }

        const tripNetProfit = totalRev - tripFuelCost;
        const marginPct = totalRev > 0 ? parseFloat(((tripNetProfit / totalRev) * 100).toFixed(1)) : 0;

        totalGrossRevenue += totalRev;
        totalFreightRevenue += primaryRev;
        totalCompletedSharedRevenue += sharedRev;
        totalFuelCost += tripFuelCost;

        return {
          id: t.id,
          tracking_id: t.tracking_id || `TRK-${t.id.slice(0, 6).toUpperCase()}`,
          source: t.source,
          destination: t.destination,
          completed_at: t.completed_at,
          dispatched_at: t.dispatched_at,
          planned_distance: parseFloat(t.planned_distance) || 0,
          fuel_consumed_liters: parseFloat(t.fuel_consumed_liters) || 0,
          cargo_weight: parseFloat(t.cargo_weight) || 0,
          vehicle_registration: t.vehicle?.registration_number || '—',
          vehicle_model: t.vehicle?.model_name || '—',
          driver_name: t.driver?.name || '—',
          primary_revenue: primaryRev,
          shared_cargo_revenue: sharedRev,
          shared_cargo_count: sharedCount,
          total_revenue: totalRev,
          fuel_cost: tripFuelCost,
          net_profit: tripNetProfit,
          profit_margin_pct: marginPct
        };
      });

      const totalNetProfit = totalGrossRevenue - totalFuelCost;
      const overallMarginPct = totalGrossRevenue > 0
        ? parseFloat(((totalNetProfit / totalGrossRevenue) * 100).toFixed(1))
        : 0;

      // Enrich vehicle operational costs with shared cargo profit & net margin
      const enrichedOpCosts = opCosts.map(c => {
        const sharedProfit = vehicleSharedProfitMap[c.vehicle_id] || 0;
        const totalCost = parseFloat(c.total_operational_cost) || 0;
        return {
          ...c,
          shared_profit: sharedProfit,
          net_profit: sharedProfit - totalCost
        };
      });

      res.json({
        success: true,
        data: {
          vehicles: vehicleStats,
          drivers: driverStats,
          trips: tripStats,
          utilization,
          openMaintenance,
          sharedCargoAnalytics: {
            totalPureProfit: totalSharedCargoProfit,
            sharedOrdersCount: sharedBookings.length,
            inTransitCount: sharedInTransitCount,
            deliveredCount: sharedDeliveredCount
          },
          financialSummary: {
            totalCompletedTrips: completedTrips.length,
            totalGrossRevenue,
            totalFreightRevenue,
            totalSharedCargoRevenue: totalCompletedSharedRevenue || totalSharedCargoProfit,
            totalFuelCost,
            totalNetProfit,
            overallMarginPct
          },
          completedTripsFinancials,
          fuelEfficiency: fuelEfficiency.map(fe => ({
            vehicle_id: fe.vehicle_id,
            vehicle: fe.vehicle,
            total_distance: parseFloat(fe.getDataValue('total_distance')),
            total_fuel: parseFloat(fe.getDataValue('total_fuel')),
            efficiency: parseFloat(fe.getDataValue('total_fuel')) > 0
              ? (parseFloat(fe.getDataValue('total_distance')) / parseFloat(fe.getDataValue('total_fuel'))).toFixed(2)
              : 0
          })),
          operationalCosts: enrichedOpCosts
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
    }
  },

  exportCSV: async (req, res) => {
    try {
      const carrierId = req.user?.carrierId || '00000000-0000-0000-0000-000000000000';
      const where = req.user?.role === 'admin' && !req.user?.carrierId ? {} : { carrier_id: carrierId };
      const vehicles = await Vehicle.findAll({ where, raw: true });
      const { Parser } = require('json2csv');

      const fields = ['registration_number', 'model_name', 'vehicle_type',
                      'max_load_capacity_kg', 'odometer', 'acquisition_cost', 'region', 'status'];
      const parser = new Parser({ fields });
      const csv = parser.parse(vehicles);

      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename="transitops_fleet_report.csv"');
      res.send(csv);
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({ success: false, message: 'Failed to export CSV' });
    }
  }
};

module.exports = analyticsController;
