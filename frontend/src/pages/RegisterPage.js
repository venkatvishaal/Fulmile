import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../services/api';
import authService from '../services/authService';
import { loginSuccess } from '../redux/slices/authSlice';
import AuthLayout, { SubmitPill } from '../components/auth/AuthLayout';
import { BsTruck, BsBoxSeam, BsPerson, BsBuilding, BsCheckCircleFill } from 'react-icons/bs';

export const passwordProblem = (pw) =>
  pw.length < 8 ? 'Password must be at least 8 characters.'
    : !/[A-Za-z]/.test(pw) ? 'Password must contain a letter.'
      : !/[0-9]/.test(pw) ? 'Password must contain a number.'
        : '';

const CARRIER_ROLES = [
  {
    value: 'fleet_manager',
    label: 'Fleet manager',
    tag: 'Fleet Admin',
    desc: 'Full dispatch control, vehicle assignments, maintenance, and freight routing.'
  },
  {
    value: 'driver',
    label: 'Driver',
    tag: 'Trip Execution',
    desc: 'Access assigned dispatches, update live GPS tracking, delivery logs, and checklists.'
  },
  {
    value: 'safety_officer',
    label: 'Safety officer',
    tag: 'Driver & Compliance',
    desc: 'Driver license vetting, compliance audits, driver suspensions, and vehicle safety logs.'
  },
  {
    value: 'financial_analyst',
    label: 'Financial analyst',
    tag: 'Profits & Margins',
    desc: 'Analyze operational costs, 100% margin shared cargo profit auditing, and fuel expense reports.'
  }
];

export default function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [agreed, setAgreed] = useState(false);

  // Top level selection: 'carrier' | 'shipper'
  const [accountType, setAccountType] = useState('carrier');

  // For carrier: 'existing' (join existing company) | 'new' (register brand new company)
  const [carrierMode, setCarrierMode] = useState('new');
  const [existingCarriers, setExistingCarriers] = useState([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState('');

  // For shipper: 'individual' | 'company'
  const [shipperType, setShipperType] = useState('individual');

  // Carrier company details (starts empty, no dummy metadata)
  const [carrierForm, setCarrierForm] = useState({
    company_name: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contact_phone: ''
  });

  // Shipper company details (if shipperType === 'company')
  const [shipperCompanyForm, setShipperCompanyForm] = useState({
    companyName: '',
    gstNumber: ''
  });

  // Personal user credentials (starts empty, no dummy metadata)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'fleet_manager'
  });

  // Fetch list of existing carrier companies on mount
  useEffect(() => {
    let isMounted = true;
    api.get('/carriers/public-list')
      .then((res) => {
        if (!isMounted) return;
        const list = res.data?.data || [];
        setExistingCarriers(list);
        if (list.length > 0) {
          setCarrierMode('existing');
          setSelectedCarrierId(String(list[0].id));
        }
      })
      .catch((err) => {
        console.warn('Could not load public carrier list:', err);
      });

    return () => { isMounted = false; };
  }, []);

  const handleUserChange = (e) => {
    setFieldErrors({ ...fieldErrors, [e.target.name]: undefined });
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const handleCarrierChange = (e) => {
    setCarrierForm({ ...carrierForm, [e.target.name]: e.target.value });
  };

  const handleShipperCompanyChange = (e) => {
    setShipperCompanyForm({ ...shipperCompanyForm, [e.target.name]: e.target.value });
  };

  const currentSelectedCarrier = existingCarriers.find(
    (c) => String(c.id) === String(selectedCarrierId)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (userForm.password !== userForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const pwProblem = passwordProblem(userForm.password);
    if (pwProblem) {
      setFieldErrors({ password: pwProblem });
      return;
    }
    if (userForm.phone && !/^[0-9]{10,15}$/.test(userForm.phone)) {
      setFieldErrors({ phone: 'Phone must be 10-15 digits, numbers only.' });
      return;
    }

    if (accountType === 'carrier') {
      if (carrierMode === 'existing') {
        if (!selectedCarrierId) {
          toast.error('Please select an existing logistics company from the list.');
          return;
        }
      } else {
        if (!carrierForm.company_name.trim()) {
          toast.error('Please enter your carrier logistics company name.');
          return;
        }
      }
    } else if (accountType === 'shipper' && shipperType === 'company') {
      if (!shipperCompanyForm.companyName.trim()) {
        toast.error('Please enter your company/business name.');
        return;
      }
    }

    if (!agreed) {
      toast.error('Please accept the Terms and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        phone: userForm.phone ? userForm.phone.trim() : undefined,
        accountType
      };

      if (accountType === 'carrier') {
        payload.role = userForm.role;
        if (carrierMode === 'existing') {
          payload.carrier = {
            id: selectedCarrierId,
            company_name: currentSelectedCarrier?.company_name || ''
          };
        } else {
          payload.carrier = {
            company_name: carrierForm.company_name.trim(),
            gst_number: carrierForm.gst_number ? carrierForm.gst_number.trim() : null,
            address: carrierForm.address ? carrierForm.address.trim() : null,
            city: carrierForm.city ? carrierForm.city.trim() : null,
            state: carrierForm.state ? carrierForm.state.trim() : null,
            pincode: carrierForm.pincode ? carrierForm.pincode.trim() : null,
            contact_phone: carrierForm.contact_phone ? carrierForm.contact_phone.trim() : null
          };
        }
      } else {
        payload.role = 'shipper';
        payload.shipperType = shipperType;
        if (shipperType === 'company') {
          payload.companyName = shipperCompanyForm.companyName.trim();
          payload.gstNumber = shipperCompanyForm.gstNumber ? shipperCompanyForm.gstNumber.trim() : null;
        }
      }

      const res = await authService.register(payload);
      dispatch(loginSuccess({ user: res.data.data, token: res.data.token }));
      
      const compName = accountType === 'carrier' 
        ? (carrierMode === 'existing' ? currentSelectedCarrier?.company_name : carrierForm.company_name)
        : '';

      toast.success(`Welcome to TransitOps, ${res.data.data.name}! ${compName ? `(${compName})` : ''}`);

      if (accountType === 'shipper') {
        navigate('/book-freight');
      } else if (userForm.role === 'driver') {
        navigate('/trips');
      } else if (userForm.role === 'financial_analyst') {
        navigate('/reports');
      } else if (userForm.role === 'safety_officer') {
        navigate('/drivers');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) setFieldErrors(Object.fromEntries(errors.map((x) => [x.field, x.message])));
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const filled = [userForm.name, userForm.email, userForm.phone, userForm.password, userForm.confirmPassword].filter(Boolean).length;
  const mismatch = userForm.confirmPassword !== '' && userForm.confirmPassword !== userForm.password;
  const ready = !passwordProblem(userForm.password) && userForm.password === userForm.confirmPassword && !!userForm.name && !!userForm.email;

  return (
    <AuthLayout
      checkpoint="02"
      title="Create account."
      lead={accountType === 'carrier' ? 'Set up your carrier company and fleet team.' : 'Book, ship, and track cargo worldwide.'}
      scene={{ variant: 'stack', status: loading ? 'busy' : 'idle', filled, role: accountType === 'carrier' ? userForm.role : 'shipper', ready }}
      readout={{ tone: ready ? 'ready' : filled ? 'typing' : 'idle', text: ready ? 'Ready to register' : `Fitting credentials · ${filled}/5 completed`, meta: accountType === 'carrier' ? 'Logistics Carrier' : 'Freight Shipper' }}
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-ink underline decoration-signal decoration-2 underline-offset-4 hover:decoration-ink">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* Step 1: Select Carrier or Shipper */}
        <div>
          <label className="label mb-2">Account Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType('carrier')}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all ${
                accountType === 'carrier'
                  ? 'border-ink bg-ink text-paper shadow-sm'
                  : 'border-ink/15 bg-surface text-ink hover:border-ink/30'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-[14px]">
                <BsTruck className="text-base" /> Logistics Carrier
              </div>
              <p className={`text-[11px] leading-tight ${accountType === 'carrier' ? 'text-paper/75' : 'text-muted'}`}>
                Company fleet, vehicles, drivers & operations
              </p>
            </button>

            <button
              type="button"
              onClick={() => setAccountType('shipper')}
              className={`flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-all ${
                accountType === 'shipper'
                  ? 'border-ink bg-ink text-paper shadow-sm'
                  : 'border-ink/15 bg-surface text-ink hover:border-ink/30'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-[14px]">
                <BsBoxSeam className="text-base" /> Freight Shipper
              </div>
              <p className={`text-[11px] leading-tight ${accountType === 'shipper' ? 'text-paper/75' : 'text-muted'}`}>
                Book freight cargo & track shipments
              </p>
            </button>
          </div>
        </div>

        {/* ── CARRIER DETAILS ── */}
        {accountType === 'carrier' && (
          <div className="rounded-xl border border-line bg-paper/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-bold">1. Carrier Logistics Company</span>
              <span className="text-[11px] text-muted font-mono">Company Profile</span>
            </div>

            {/* Mode Selector: Join Existing Company vs Register New */}
            {existingCarriers.length > 0 && (
              <div className="flex rounded-lg bg-surface p-1 border border-ink/10 gap-1">
                <button
                  type="button"
                  onClick={() => setCarrierMode('existing')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-[12px] font-semibold transition-all ${
                    carrierMode === 'existing'
                      ? 'bg-ink text-paper shadow-xs'
                      : 'text-ink/70 hover:text-ink hover:bg-paper/50'
                  }`}
                >
                  Join Existing Company ({existingCarriers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCarrierMode('new')}
                  className={`flex-1 py-1.5 px-3 rounded-md text-[12px] font-semibold transition-all ${
                    carrierMode === 'new'
                      ? 'bg-ink text-paper shadow-xs'
                      : 'text-ink/70 hover:text-ink hover:bg-paper/50'
                  }`}
                >
                  + Register New Company
                </button>
              </div>
            )}

            {carrierMode === 'existing' && existingCarriers.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <label htmlFor="select-carrier" className="label">
                    Select Logistics Company to Join *
                  </label>
                  <select
                    id="select-carrier"
                    value={selectedCarrierId}
                    onChange={(e) => setSelectedCarrierId(e.target.value)}
                    className="field py-2.5 font-medium cursor-pointer"
                  >
                    {existingCarriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name} {c.city ? `(${c.city}${c.state ? `, ${c.state}` : ''})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {currentSelectedCarrier && (
                  <div className="rounded-lg border border-signal/25 bg-signal/10 p-3 text-[12px] text-ink/85 flex items-start gap-2.5">
                    <BsCheckCircleFill className="text-signal text-base shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-ink">
                        Joining team for: {currentSelectedCarrier.company_name}
                      </p>
                      <p className="text-[11px] text-ink/70 leading-relaxed">
                        You will be registered under this logistics company. You will collaborate on the same fleet vehicles, live transit trips, shared cargo corridors, and financial analytics.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="company-name" className="label">Logistics Company Name *</label>
                  <input
                    id="company-name"
                    type="text"
                    name="company_name"
                    value={carrierForm.company_name}
                    onChange={handleCarrierChange}
                    required
                    placeholder="e.g. Apex Freight Logistics Pvt Ltd"
                    className="field py-2.5"
                  />
                  <p className="mt-1 text-[11px] text-muted">
                    If this company already exists, your account will automatically join the existing company organization.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="carrier-gst" className="label">GST / Tax ID <span className="normal-case text-muted font-normal">(optional)</span></label>
                    <input
                      id="carrier-gst"
                      type="text"
                      name="gst_number"
                      value={carrierForm.gst_number}
                      onChange={handleCarrierChange}
                      placeholder="29AADCB2230M1Z2"
                      className="field py-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="carrier-phone" className="label">Company Phone <span className="normal-case text-muted font-normal">(optional)</span></label>
                    <input
                      id="carrier-phone"
                      type="tel"
                      name="contact_phone"
                      value={carrierForm.contact_phone}
                      onChange={handleCarrierChange}
                      placeholder="080-2345678"
                      className="field py-2.5"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="carrier-city" className="label">City <span className="normal-case text-muted font-normal">(optional)</span></label>
                    <input
                      id="carrier-city"
                      type="text"
                      name="city"
                      value={carrierForm.city}
                      onChange={handleCarrierChange}
                      placeholder="Bangalore"
                      className="field py-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="carrier-state" className="label">State <span className="normal-case text-muted font-normal">(optional)</span></label>
                    <input
                      id="carrier-state"
                      type="text"
                      name="state"
                      value={carrierForm.state}
                      onChange={handleCarrierChange}
                      placeholder="Karnataka"
                      className="field py-2.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="carrier-pincode" className="label">Pincode <span className="normal-case text-muted font-normal">(optional)</span></label>
                    <input
                      id="carrier-pincode"
                      type="text"
                      name="pincode"
                      value={carrierForm.pincode}
                      onChange={handleCarrierChange}
                      placeholder="560001"
                      className="field py-2.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Role under Carrier */}
            <div className="pt-2 border-t border-line/60">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">2. Select Your Role in This Company *</label>
                <span className="text-[11px] text-muted font-mono">
                  {carrierMode === 'existing' && currentSelectedCarrier ? currentSelectedCarrier.company_name : (carrierForm.company_name || 'Fleet Team')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CARRIER_ROLES.map(({ value, label, tag, desc }) => {
                  const isSelected = userForm.role === value;
                  return (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-xl border p-3 transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-ink bg-ink text-paper shadow-sm ring-1 ring-ink'
                          : 'border-ink/15 bg-surface/60 text-ink hover:border-ink/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={value}
                        checked={isSelected}
                        onChange={handleUserChange}
                        className="sr-only"
                      />
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[13px] font-bold">{label}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${isSelected ? 'bg-paper/20 text-paper' : 'bg-ink/5 text-ink/70'}`}>
                            {tag}
                          </span>
                        </div>
                        <p className={`text-[11px] leading-snug ${isSelected ? 'text-paper/80' : 'text-muted'}`}>
                          {desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SHIPPER DETAILS ── */}
        {accountType === 'shipper' && (
          <div className="rounded-xl border border-line bg-paper/60 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-bold">1. Shipper Classification</span>
              <span className="text-[11px] text-muted font-mono">Cargo Sender</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="shipperType"
                  value="individual"
                  checked={shipperType === 'individual'}
                  onChange={() => setShipperType('individual')}
                  className="peer sr-only"
                />
                <div className="flex items-center gap-2 rounded-lg border border-ink/15 p-3 text-ink/80 transition-all peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper">
                  <BsPerson className="text-lg shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold">Individual</p>
                    <p className="text-[10px] opacity-75">Personal shipments</p>
                  </div>
                </div>
              </label>

              <label className="cursor-pointer">
                <input
                  type="radio"
                  name="shipperType"
                  value="company"
                  checked={shipperType === 'company'}
                  onChange={() => setShipperType('company')}
                  className="peer sr-only"
                />
                <div className="flex items-center gap-2 rounded-lg border border-ink/15 p-3 text-ink/80 transition-all peer-checked:border-ink peer-checked:bg-ink peer-checked:text-paper">
                  <BsBuilding className="text-lg shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold">Company / Biz</p>
                    <p className="text-[10px] opacity-75">Corporate freight</p>
                  </div>
                </div>
              </label>
            </div>

            {shipperType === 'company' && (
              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-line/60">
                <div>
                  <label htmlFor="shipper-comp-name" className="label">Company / Business Name *</label>
                  <input
                    id="shipper-comp-name"
                    type="text"
                    name="companyName"
                    value={shipperCompanyForm.companyName}
                    onChange={handleShipperCompanyChange}
                    required
                    placeholder="e.g. Acme Manufacturing"
                    className="field py-2.5"
                  />
                </div>
                <div>
                  <label htmlFor="shipper-gst" className="label">GSTIN / Tax ID <span className="normal-case text-muted font-normal">(optional)</span></label>
                  <input
                    id="shipper-gst"
                    type="text"
                    name="gstNumber"
                    value={shipperCompanyForm.gstNumber}
                    onChange={handleShipperCompanyChange}
                    placeholder="27AABCU9603R1ZX"
                    className="field py-2.5"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USER CREDENTIALS (NO PRE-FILLED METADATA) ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted font-bold">
              {accountType === 'carrier' ? '3. Account Credentials' : '2. Account Credentials'}
            </span>
          </div>

          <div>
            <label htmlFor="reg-name" className="label">
              {accountType === 'shipper' && shipperType === 'company' ? 'Contact Person Name *' : 'Full Name *'}
            </label>
            <input
              id="reg-name"
              type="text"
              name="name"
              value={userForm.name}
              onChange={handleUserChange}
              required
              autoComplete="name"
              placeholder="e.g. Rahul Sharma"
              className="field py-3"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-email" className="label">Email Address *</label>
              <input
                id="reg-email"
                type="email"
                name="email"
                value={userForm.email}
                onChange={handleUserChange}
                required
                autoComplete="email"
                placeholder="you@domain.com"
                aria-invalid={!!fieldErrors.email || undefined}
                className={`field py-3 ${fieldErrors.email ? 'field-error' : ''}`}
              />
              {fieldErrors.email && <p className="error-text">{fieldErrors.email}</p>}
            </div>
            <div>
              <label htmlFor="reg-phone" className="label">Mobile Phone <span className="normal-case text-muted font-normal">(optional)</span></label>
              <input
                id="reg-phone"
                type="tel"
                name="phone"
                value={userForm.phone}
                onChange={handleUserChange}
                autoComplete="tel"
                inputMode="numeric"
                placeholder="9876543210"
                aria-invalid={!!fieldErrors.phone || undefined}
                className={`field py-3 ${fieldErrors.phone ? 'field-error' : ''}`}
              />
              {fieldErrors.phone && <p className="error-text">{fieldErrors.phone}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="reg-password" className="label">Password *</label>
              <input
                id="reg-password"
                type="password"
                name="password"
                value={userForm.password}
                onChange={handleUserChange}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="8+ chars, letter + number"
                aria-invalid={!!fieldErrors.password || undefined}
                className={`field py-3 ${fieldErrors.password ? 'field-error' : ''}`}
              />
              <p className={fieldErrors.password ? 'error-text' : 'mt-1 text-[11px] text-muted'}>
                {fieldErrors.password || 'Min 8 characters with letters & numbers'}
              </p>
            </div>
            <div>
              <label htmlFor="reg-confirm" className="label">Confirm Password *</label>
              <input
                id="reg-confirm"
                type="password"
                name="confirmPassword"
                value={userForm.confirmPassword}
                onChange={handleUserChange}
                required
                autoComplete="new-password"
                placeholder="Repeat password"
                aria-invalid={mismatch || undefined}
                className={`field py-3 ${mismatch ? 'field-error' : ''}`}
              />
              {mismatch && <p className="error-text">Passwords don’t match yet.</p>}
            </div>
          </div>
        </div>

        <label className="flex items-start gap-3 text-[13px] text-ink/75">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 accent-ink"
          />
          <span>I accept the <Link to="/terms" target="_blank" className="font-semibold text-ink underline underline-offset-4">Terms</Link> and <Link to="/privacy" target="_blank" className="font-semibold text-ink underline underline-offset-4">Privacy Policy</Link>.</span>
        </label>

        <div className="pt-2">
          <SubmitPill loading={loading} busyLabel="Creating account…">
            {accountType === 'carrier' ? 'Create Carrier Account' : 'Create Shipper Account'}
          </SubmitPill>
        </div>
      </form>
    </AuthLayout>
  );
}
