"use client";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Gauge,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  X,
  AlertTriangle,
  RefreshCw,
  IndianRupee,
  Building2,
  ClipboardCheck,
  Leaf,
} from "lucide-react";
import type { User } from "@/lib/types";
type Row = Record<string, any>;
const money = (n: unknown) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(Number(n ?? 0)) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Number(n ?? 0));
const number = (n: unknown) =>
  new Intl.NumberFormat("en-IN").format(Number(n ?? 0));
const date = (s: string, full = false) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    ...(full ? { year: "numeric" } : {}),
  }).format(new Date(s));
const time = (s: string) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(s));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
async function api(path: string, method = "GET", data?: unknown) {
  const r = await fetch(`/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  let json;
  try {
    json = await r.json();
  } catch {
    throw new Error("Could not read the server response. Please retry.");
  }
  if (!r.ok)
    throw new Error(
      json.error?.message || "Something went wrong. Please retry.",
    );
  return json.data;
}
function useResource(path: string, rev = 0) {
  const [state, setState] = useState<{
      path: string;
      data: any;
      error: string;
      loading: boolean;
    }>({ path, data: null, error: "", loading: true }),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let ignore = false;
    setState((old) => ({
      path,
      data: old.path === path ? old.data : null,
      error: "",
      loading: true,
    }));
    api(path)
      .then((data) => {
        if (!ignore) setState({ path, data, error: "", loading: false });
      })
      .catch((e) => {
        if (!ignore)
          setState({ path, data: null, error: e.message, loading: false });
      });
    return () => {
      ignore = true;
    };
  }, [path, rev, retry]);
  const current =
    state.path === path
      ? state
      : { path, data: null, error: "", loading: true };
  return { ...current, retry: () => setRetry((x) => x + 1) };
}
function Loader() {
  return (
    <div className="loading">
      <RefreshCw size={22} className="spin" />
      <span>Getting everything ready…</span>
    </div>
  );
}
function ErrorPanel({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error-panel" role="alert">
      <AlertTriangle size={22} />
      <div>
        <strong>We couldn’t load this.</strong>
        <p>{message}</p>
        {retry && (
          <button className="btn secondary small" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
function Empty({
  title = "Nothing here yet",
  text = "New activity will appear here.",
  action,
}: {
  title?: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Car size={26} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Badge({ status }: { status: string }) {
  const labels: Row = {
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    NO_SHOW: "No-show",
    DUE: "Service due",
    DUE_SOON: "Due soon",
    UP_TO_DATE: "Up to date",
    INSUFFICIENT_HISTORY: "Needs history",
    PASS: "Pass",
    ATTENTION: "Attention",
    FAIL: "Fail",
  };
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <i />
      {labels[status] || status}
    </span>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, { id })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="field-control">{control}</span>
      {hint && <small>{hint}</small>}
    </div>
  );
}
function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => {
      d?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby={id}
      onCancel={onClose}
    >
      <div className="modal-head">
        <div>
          <h2 id={id}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function DataForm({
  children,
  onSubmit,
  onClose,
  label = "Save changes",
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<unknown>;
  onClose?: () => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const data = new FormData(e.currentTarget);
        try {
          await onSubmit(data);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-body">
        {children}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="form-foot">
        {onClose && (
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancel
          </button>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? (
            <RefreshCw size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {busy ? "Saving…" : label}
        </button>
      </div>
    </form>
  );
}
const val = (f: FormData, k: string) => String(f.get(k) || "").trim();
const nullableNumber = (f: FormData, k: string) =>
  val(f, k) ? Number(val(f, k)) : null;
function CarArt({
  color = "#b184b5",
  large = false,
}: {
  color?: string;
  large?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 360 160"
      fill="none"
      className={`car-art ${large ? "large" : ""}`}
      aria-hidden="true"
    >
      <ellipse
        cx="180"
        cy="133"
        rx="146"
        ry="8"
        fill="currentColor"
        opacity=".07"
      />
      <path
        d="M50 99 66 75l55-14 32-32h77l49 45 28 11 9 34H43V106z"
        fill={color}
      />
      <path d="m136 61 23-24h31v28zm61-24h28l30 29-58-2z" fill="#3b263e" />
      <path
        d="M57 94h56m168-7 24 9M184 72v41m-54-38v37"
        stroke="#3b263e"
        opacity=".5"
        strokeWidth="3"
      />
      <path d="M63 89h21v11H57m231-2h17v9h-17" fill="#fff1ce" />
      <path
        d="M203 77h12m-69-1h12"
        stroke="#3b263e"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="107" cy="117" r="23" fill="#302337" />
      <circle cx="107" cy="117" r="12" fill="#e6dbe6" />
      <circle cx="107" cy="117" r="5" fill="#302337" />
      <circle cx="263" cy="117" r="23" fill="#302337" />
      <circle cx="263" cy="117" r="12" fill="#e6dbe6" />
      <circle cx="263" cy="117" r="5" fill="#302337" />
      <path
        d="M37 120h26m44-54 8-5m155 8h9l8 8"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={`brand ${inverse ? "inverse" : ""}`}>
      <span className="brand-mark">
        <Activity size={24} strokeWidth={2.5} />
      </span>
      <div>
        <b>
          motive<span>°</span>
        </b>
        <small>SERVICE INTELLIGENCE</small>
      </div>
    </div>
  );
}
function Login({
  onLogin,
  initialError,
}: {
  onLogin: (u: User) => void;
  initialError: string;
}) {
  const [register, setRegister] = useState(false),
    [selected, setSelected] = useState("customer@motive.test");
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand inverse />
        <div className="auth-message">
          <div className="eyebrow light">
            <span /> A LITTLE CARE. A LONGER JOURNEY.
          </div>
          <h1>
            Keep your car.
            <br />
            Ahead of the curve.
          </h1>
          <p>
            Your vehicles, trusted workshops, and a smarter maintenance plan.
            All moving together.
          </p>
          <CarArt color="#f1bd86" large />
          <div className="auth-benefits">
            <span>
              <ShieldCheck size={19} /> Your history, connected
            </span>
            <span>
              <Sparkles size={19} /> Maintenance, explained
            </span>
          </div>
        </div>
        <small className="auth-credit">Built for the road ahead.</small>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO MOTIVE</span>
          <h2>
            {register
              ? "Your next journey starts here."
              : "Good to see you again."}
          </h2>
          <p>
            {register
              ? "Create a customer account to get started."
              : "Sign in to your service workspace."}
          </p>
          {initialError && (
            <p className="form-error">
              {initialError} Run the local setup if the databases are not
              started.
            </p>
          )}
          <DataForm
            label={register ? "Create account" : "Sign in"}
            onSubmit={async (f) => {
              const u = await api(
                register ? "auth/register" : "auth/login",
                "POST",
                {
                  ...(register ? { name: val(f, "name") } : {}),
                  email: val(f, "email"),
                  password: String(f.get("password")),
                },
              );
              onLogin(u);
            }}
          >
            {register && (
              <Field label="Full name">
                <input
                  name="name"
                  autoComplete="name"
                  required
                  minLength={2}
                  placeholder="Your full name"
                />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <Field
              label="Password"
              hint={
                register
                  ? "At least 10 characters; maximum 72 bytes."
                  : undefined
              }
            >
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 10 : 1}
                placeholder="Enter your password"
              />
            </Field>
          </DataForm>
          <p className="switch-auth">
            {register ? "Already have an account?" : "New to Motive?"}{" "}
            <button
              className="text-btn"
              onClick={() => {
                setRegister(!register);
                setSelected("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          {!register && (
            <div className="demo-box">
              <b>Explore a demo workspace</b>
              <div>
                {["Customer", "Staff", "Admin"].map((r) => (
                  <button
                    key={r}
                    className={
                      selected === `${r.toLowerCase()}@motive.test`
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setSelected(`${r.toLowerCase()}@motive.test`)
                    }
                  >
                    {r}
                  </button>
                ))}
              </div>
              <small>
                Use the DEMO_PASSWORD generated in your local .env.local file.
              </small>
            </div>
          )}
          <p className="auth-note">
            <ShieldCheck size={14} /> Secure access. Your vehicle data stays in
            your workspace.
          </p>
        </div>
      </section>
    </main>
  );
}
const customerNav = [
  ["overview", "Overview", LayoutDashboard],
  ["garage", "My garage", Car],
  ["book", "Book a service", CalendarDays],
  ["bookings", "My bookings", ClipboardCheck],
  ["history", "Service history", BookOpen],
  ["maintenance", "Maintenance", Activity],
  ["reports", "Insights & spending", TrendingUp],
] as const;
const staffNav = [
  ["overview", "Overview", LayoutDashboard],
  ["bookings", "Work queue", ClipboardCheck],
  ["slots", "Arrival slots", CalendarDays],
  ["reports", "Centre insights", TrendingUp],
] as const;
const adminNav = [
  ["overview", "Overview", LayoutDashboard],
  ["centres", "Service centres", Building2],
  ["team", "Team members", Users],
  ["reports", "Platform insights", TrendingUp],
] as const;
export default function Workspace() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [bootError, setBootError] = useState(""),
    [page, setPage] = useState("overview"),
    [rev, setRev] = useState(0),
    [catalogue, setCatalogue] = useState<Row>({ services: [], faults: [] }),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (r) => {
        if (r.ok) setUser((await r.json()).data);
        else if (r.status !== 401)
          setBootError("The local databases could not be reached.");
      })
      .catch(() => setBootError("The application could not reach the server."))
      .finally(() => setBoot(false));
  }, []);
  useEffect(() => {
    if (user)
      api("catalogue")
        .then(setCatalogue)
        .catch(() => {});
  }, [user]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const changed = useCallback((message = "Saved successfully.") => {
    setRev((x) => x + 1);
    setToast(message);
  }, []);
  const nav = useCallback((p: string) => {
    setPage(p);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  if (boot) return <Loader />;
  if (!user)
    return (
      <Login
        initialError={bootError}
        onLogin={(u) => {
          setUser(u);
          setBootError("");
          setPage("overview");
          setMenu(false);
        }}
      />
    );
  const links =
    user.role === "CUSTOMER"
      ? customerNav
      : user.role === "STAFF"
        ? staffNav
        : adminNav;
  const props = { user, rev, changed, nav, catalogue };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Brand />
        <div className="workspace-label">
          {user.role === "CUSTOMER"
            ? "YOUR WORKSPACE"
            : user.role === "STAFF"
              ? "CENTRE WORKSPACE"
              : "PLATFORM WORKSPACE"}
        </div>
        <nav aria-label="Main navigation">
          {links.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => nav(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "book" && <Plus size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-card">
            <span className="care-icon">
              <Leaf size={20} />
            </span>
            <b>A little care goes far.</b>
            <p>Regular maintenance makes every kilometre count.</p>
          </div>
          <button
            className="profile-logout"
            onClick={async () => {
              try {
                await api("auth/logout", "POST", {});
                setUser(null);
                setPage("overview");
                setMenu(false);
              } catch (e) {
                setToast((e as Error).message);
              }
            }}
          >
            <LogOut size={17} />
            Sign out
            <ArrowUpRight size={14} />
          </button>
          <small>MOTIVE · VEHICLE CARE, CONNECTED</small>
        </div>
      </aside>
      {menu && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <span>
              {user.role === "CUSTOMER"
                ? "My workspace"
                : user.centre_name || "Administration"}
            </span>
            <ChevronRight size={14} />
            <b>{links.find((l) => l[0] === page)?.[1]}</b>
          </div>
          <div className="top-actions">
            <span className="today">
              <CalendarDays size={15} />
              {date(new Date().toISOString(), true)}
            </span>
            <button
              className="icon-btn notification"
              title="View maintenance and activity"
              aria-label="View alerts"
              onClick={() =>
                nav(user.role === "CUSTOMER" ? "maintenance" : "bookings")
              }
            >
              <Bell size={19} />
              <i />
            </button>
            <span className="top-divider" />
            <div className="avatar">
              {user.name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="profile">
              <b>{user.name}</b>
              <small>
                {user.role === "CUSTOMER"
                  ? "Vehicle owner"
                  : user.role === "STAFF"
                    ? "Service specialist"
                    : "Platform administrator"}
              </small>
            </div>
          </div>
        </header>
        <main className="main-content" key={`${user.role}-${page}`}>
          {page === "overview" ? (
            <Overview {...props} />
          ) : page === "garage" ? (
            <Garage {...props} />
          ) : page === "book" ? (
            <BookService {...props} />
          ) : page === "bookings" ? (
            <Bookings {...props} />
          ) : page === "history" ? (
            <Bookings {...props} history />
          ) : page === "maintenance" ? (
            <Maintenance {...props} />
          ) : page === "slots" ? (
            <Slots {...props} />
          ) : page === "centres" ? (
            <Centres {...props} />
          ) : page === "team" ? (
            <Team {...props} />
          ) : (
            <Reports {...props} />
          )}
        </main>
        <footer className="page-footer">
          <span>Thoughtful care for every kilometre.</span>
          <span>
            <span className="live-dot" /> Motive service intelligence
          </span>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
type Props = {
  user: User;
  rev: number;
  changed: (s?: string) => void;
  nav: (p: string) => void;
  catalogue: Row;
};
function Heading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
  detail,
  color = "green",
}: {
  label: string;
  value: string;
  icon: typeof Car;
  detail: string;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${color}`}>
          <Icon size={19} />
        </div>
      </div>
      <b className="stat-value">{value}</b>
      <small>{detail}</small>
    </div>
  );
}
function SectionTitle({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function Overview(p: Props) {
  const r = useResource("dashboard", p.rev);
  if (r.loading && !r.data) return <Loader />;
  if (r.error) return <ErrorPanel message={r.error} retry={r.retry} />;
  const d = r.data;
  const due = d.maintenance.filter((x: Row) => x.status === "DUE").length,
    soon = d.maintenance.filter((x: Row) => x.status === "DUE_SOON").length;
  const active = d.report.statuses
    .filter((s: Row) => ["CONFIRMED", "IN_PROGRESS"].includes(s.status))
    .reduce((n: number, s: Row) => n + s.count, 0);
  return (
    <>
      <Heading
        eyebrow={
          p.user.role === "CUSTOMER"
            ? "YOUR VEHICLE CARE, AT A GLANCE"
            : "SERVICE OPERATIONS, CONNECTED"
        }
        title={`Hello, ${p.user.name.split(" ")[0]}.`}
        text={
          p.user.role === "CUSTOMER"
            ? "A clearer picture of your garage. A better plan for the road ahead."
            : "Keep your team, bookings, and service activity moving together."
        }
        action={
          <button
            className="btn primary"
            onClick={() =>
              p.nav(
                p.user.role === "CUSTOMER"
                  ? "book"
                  : p.user.role === "STAFF"
                    ? "slots"
                    : "centres",
              )
            }
          >
            <Plus size={18} />
            {p.user.role === "CUSTOMER"
              ? "Book a service"
              : p.user.role === "STAFF"
                ? "Manage slots"
                : "Manage centres"}
          </button>
        }
      />
      <div className="stats-grid">
        {p.user.role === "CUSTOMER" ? (
          <>
            <Stat
              label="Vehicles in your garage"
              value={String(d.stats.vehicles).padStart(2, "0")}
              icon={Car}
              detail="All your vehicles, one place"
            />
            <Stat
              label="Maintenance attention"
              value={String(due + soon).padStart(2, "0")}
              icon={Wrench}
              detail={`${due} due · ${soon} approaching`}
              color="amber"
            />
            <Stat
              label="Service spending"
              value={money(d.report.totals.charges)}
              icon={IndianRupee}
              detail="Recorded charges · last 6 months"
              color="blue"
            />
            <Stat
              label="Completed services"
              value={String(d.report.totals.completed).padStart(2, "0")}
              icon={ShieldCheck}
              detail="A history you can look back on"
              color="purple"
            />
          </>
        ) : (
          <>
            <Stat
              label={
                p.user.role === "STAFF"
                  ? "Active bookings"
                  : "Active service centres"
              }
              value={String(
                p.user.role === "STAFF" ? active : d.stats.centres,
              ).padStart(2, "0")}
              icon={p.user.role === "STAFF" ? CalendarDays : Building2}
              detail={
                p.user.role === "STAFF"
                  ? "Confirmed and in progress"
                  : "Ready to receive bookings"
              }
            />
            <Stat
              label="Completed services"
              value={String(d.report.totals.completed).padStart(2, "0")}
              icon={CheckCircle2}
              detail="Last 6 months"
              color="blue"
            />
            <Stat
              label="Recorded charges"
              value={money(d.report.totals.charges)}
              icon={IndianRupee}
              detail="Service amounts · not payments"
              color="amber"
            />
            <Stat
              label={
                p.user.role === "STAFF"
                  ? "Booking activity"
                  : "Active team members"
              }
              value={String(
                p.user.role === "STAFF"
                  ? d.report.statuses.reduce(
                      (n: number, s: Row) => n + s.count,
                      0,
                    )
                  : d.stats.staff,
              ).padStart(2, "0")}
              icon={Users}
              detail={
                p.user.role === "STAFF"
                  ? "Across all tracked statuses"
                  : "Across service centres"
              }
              color="purple"
            />
          </>
        )}
      </div>
      <div className="overview-columns">
        <div className="overview-main">
          <div className="journey-card">
            <div>
              <span className="eyebrow light">
                <Sparkles size={13} /> AHEAD OF THE NEXT SERVICE
              </span>
              <h2>
                {p.user.role === "CUSTOMER" ? (
                  <>
                    More road.
                    <br />
                    Less guesswork.
                  </>
                ) : (
                  <>
                    Good service starts
                    <br />
                    with a clear plan.
                  </>
                )}
              </h2>
              <p>
                {p.user.role === "CUSTOMER"
                  ? "Your service history and mileage turn into timely, explainable maintenance reminders."
                  : "See every arrival, keep inspections connected, and turn completed work into a dependable record."}
              </p>
              <button
                className="btn light-btn"
                onClick={() =>
                  p.nav(
                    p.user.role === "CUSTOMER"
                      ? "maintenance"
                      : p.user.role === "STAFF"
                        ? "bookings"
                        : "reports",
                  )
                }
              >
                {p.user.role === "CUSTOMER"
                  ? "Check maintenance"
                  : "Open workspace"}
                <ArrowRight size={16} />
              </button>
            </div>
            <div className="hero-car">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <CarArt color="#f1bd86" large />
              <span className="hero-car-label">
                <span className="live-dot" /> Care that keeps you moving
              </span>
            </div>
          </div>
          <section className="panel">
            <SectionTitle
              title={
                p.user.role === "CUSTOMER"
                  ? "Your recent service activity"
                  : "Service activity"
              }
              sub="Bookings and service updates, connected."
              action={
                <button
                  className="text-btn"
                  onClick={() =>
                    p.nav(p.user.role === "ADMIN" ? "reports" : "bookings")
                  }
                >
                  View all <ArrowRight size={14} />
                </button>
              }
            />
            {d.bookings.length ? (
              <div className="activity-list">
                {d.bookings.slice(0, 4).map((b: Row) => (
                  <div className="activity-item" key={b.id}>
                    <div className="activity-icon">
                      <Wrench size={19} />
                    </div>
                    <div className="activity-info">
                      <b>{b.service_name}</b>
                      <span>
                        {b.make} {b.model} <i>·</i> {b.registration}
                      </span>
                      <small>
                        <MapPin size={12} />
                        {b.centre_name}
                      </small>
                    </div>
                    <div className="activity-end">
                      <Badge status={b.status} />
                      <small>
                        {date(b.starts_at)} · {time(b.starts_at)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title="Your next service starts here"
                text="Book a centre to begin your connected service history."
              />
            )}
          </section>
        </div>
        <div className="overview-aside">
          {p.user.role === "CUSTOMER" ? (
            <>
              <section className="panel attention-panel">
                <SectionTitle
                  title="Needs a little attention"
                  sub="Small steps. Smoother journeys."
                />
                <div className="maintenance-mini">
                  {d.maintenance
                    .filter((m: Row) => m.status !== "UP_TO_DATE")
                    .sort(
                      (a: Row, b: Row) =>
                        (({ DUE: 0, DUE_SOON: 1, INSUFFICIENT_HISTORY: 2 })[
                          a.status as "DUE"
                        ] ?? 3) -
                        ({ DUE: 0, DUE_SOON: 1, INSUFFICIENT_HISTORY: 2 }[
                          b.status as "DUE"
                        ] ?? 3),
                    )
                    .slice(0, 3)
                    .map((m: Row) => (
                      <div className="mini-rule" key={m.id}>
                        <span
                          className={`mini-icon ${m.status === "DUE" ? "amber" : "green"}`}
                        >
                          <Wrench size={17} />
                        </span>
                        <div>
                          <b>{m.service_name}</b>
                          <span>{m.registration}</span>
                          <small>
                            {m.kmRemaining !== null
                              ? `${number(Math.abs(m.kmRemaining))} km ${m.kmRemaining <= 0 ? "over threshold" : "remaining"}`
                              : "Add service history to calculate"}
                          </small>
                        </div>
                        <span
                          className={`mini-dot ${m.status === "DUE" ? "amber" : ""}`}
                        />
                      </div>
                    ))}
                  {!d.maintenance.length && (
                    <p className="muted">
                      Add a maintenance rule to see reminders.
                    </p>
                  )}
                </div>
                <button
                  className="btn secondary full"
                  onClick={() => p.nav("maintenance")}
                >
                  View maintenance plan <ArrowRight size={15} />
                </button>
              </section>
              <section className="tip-card">
                <div className="tip-heading">
                  <span>
                    <Sparkles size={18} />
                  </span>{" "}
                  THE MOTIVE NOTE
                </div>
                <h3>Your mileage tells a story.</h3>
                <p>
                  Keep your odometer reading current for more useful maintenance
                  reminders.
                </p>
                <button className="text-btn" onClick={() => p.nav("garage")}>
                  Update your mileage <ArrowUpRight size={14} />
                </button>
              </section>
            </>
          ) : (
            <section className="panel">
              <SectionTitle
                title="Booking snapshot"
                sub="All tracked booking states."
              />
              <div className="status-list">
                {d.report.statuses.map((s: Row) => (
                  <div key={s.status}>
                    <Badge status={s.status} />
                    <b>{s.count}</b>
                  </div>
                ))}
              </div>
              <button
                className="btn secondary full"
                onClick={() => p.nav("reports")}
              >
                Explore insights <ArrowRight size={15} />
              </button>
            </section>
          )}
        </div>
      </div>
      <section className="panel spending-panel">
        <SectionTitle
          title={
            p.user.role === "CUSTOMER"
              ? "A little perspective on spending"
              : "Service charge trends"
          }
          sub="Monthly recorded service charges · last 6 months"
          action={
            <span className="subtle-label">
              <span className="chart-key" /> Service charges
            </span>
          }
        />
        <BarChart rows={d.report.monthly} />
      </section>
    </>
  );
}
function BarChart({ rows }: { rows: Row[] }) {
  if (!rows.length)
    return (
      <Empty
        title="No charges recorded"
        text="Completed service records will appear in this report."
      />
    );
  const max = Math.max(...rows.map((r) => Number(r.total)), 1);
  return (
    <div className="bar-chart">
      {rows.map((r, i) => (
        <div className="chart-column" key={r.month}>
          <span className="chart-value">{money(r.total)}</span>
          <div className="bar-track">
            <div
              className={`chart-bar ${i === rows.length - 1 ? "last" : ""}`}
              style={{
                height: `${Math.max(5, (Number(r.total) / max) * 100)}%`,
              }}
            />
          </div>
          <span className="chart-label">
            {new Date(`${r.month}-01T00:00:00`).toLocaleDateString("en-IN", {
              month: "short",
              year: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}
function VehicleForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal
      title="Add a vehicle"
      subtitle="Give your next journey a place to start."
      onClose={onClose}
    >
      <DataForm
        label="Add vehicle"
        onClose={onClose}
        onSubmit={async (f) => {
          await api("vehicles", "POST", {
            registration: val(f, "registration"),
            make: val(f, "make"),
            model: val(f, "model"),
            modelYear: Number(val(f, "modelYear")),
            currentKm: Number(val(f, "currentKm")),
          });
          onSaved();
          onClose();
        }}
      >
        <Field label="Registration number">
          <input
            name="registration"
            placeholder="KA01MN1234"
            required
            maxLength={20}
          />
        </Field>
        <div className="form-grid">
          <Field label="Make">
            <input name="make" placeholder="Hyundai" required maxLength={60} />
          </Field>
          <Field label="Model">
            <input name="model" placeholder="Creta" required maxLength={60} />
          </Field>
          <Field label="Model year">
            <input
              name="modelYear"
              type="number"
              defaultValue={new Date().getFullYear()}
              required
              min={1900}
              max={2100}
            />
          </Field>
          <Field label="Current mileage (km)">
            <input
              name="currentKm"
              type="number"
              min={0}
              max={2147483647}
              required
              placeholder="e.g. 29700"
            />
          </Field>
        </div>
      </DataForm>
    </Modal>
  );
}
function MileageModal({
  vehicle,
  onClose,
  changed,
}: {
  vehicle: Row;
  onClose: () => void;
  changed: Props["changed"];
}) {
  return (
    <Modal
      title="Update mileage"
      subtitle={`${vehicle.make} ${vehicle.model} · ${vehicle.registration}`}
      onClose={onClose}
    >
      <DataForm
        label="Update reading"
        onClose={onClose}
        onSubmit={async (f) => {
          await api(`vehicles/${vehicle.id}/mileage`, "PATCH", {
            currentKm: Number(val(f, "currentKm")),
          });
          changed("Mileage updated. Your maintenance plan is refreshed.");
          onClose();
        }}
      >
        <Field
          label="Current odometer reading (km)"
          hint={`Last recorded: ${number(vehicle.current_km)} km. Mileage cannot decrease.`}
        >
          <input
            name="currentKm"
            type="number"
            min={vehicle.current_km}
            max={2147483647}
            required
            defaultValue={vehicle.current_km}
          />
        </Field>
      </DataForm>
    </Modal>
  );
}
function Garage(p: Props) {
  const r = useResource("vehicles?pageSize=100", p.rev),
    [add, setAdd] = useState(false),
    [mileage, setMileage] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [edit, setEdit] = useState<Row | null>(null);
  return (
    <>
      <Heading
        eyebrow="EVERY VEHICLE, CONNECTED"
        title="Your garage."
        text="Keep the essentials close, and the next journey in sight."
        action={
          <button className="btn primary" onClick={() => setAdd(true)}>
            <Plus size={18} />
            Add vehicle
          </button>
        }
      />
      {r.loading ? (
        <Loader />
      ) : r.error ? (
        <ErrorPanel message={r.error} retry={r.retry} />
      ) : r.data.items.length ? (
        <div className="vehicle-grid">
          {r.data.items.map((v: Row, i: number) => (
            <section className="vehicle-card" key={v.id}>
              <div className="vehicle-top">
                <span className="plate">{v.registration}</span>
                <div className="inline-actions">
                  <span className="subtle-label">{v.model_year}</span>
                  <button
                    className="icon-btn"
                    aria-label={`Edit ${v.registration}`}
                    onClick={() => setEdit(v)}
                  >
                    <Settings2 size={15} />
                  </button>
                </div>
              </div>
              <div className={`vehicle-illustration color-${i % 3}`}>
                <CarArt color={["#b184b5", "#d49b89", "#bb9463"][i % 3]} />
              </div>
              <div className="vehicle-body">
                <div className="vehicle-title">
                  <div>
                    <small>{v.make}</small>
                    <h2>{v.model}</h2>
                  </div>
                  <ShieldCheck size={22} />
                </div>
                <div className="vehicle-mileage">
                  <Gauge size={18} />
                  <div>
                    <b>
                      {number(v.current_km)} <span>km</span>
                    </b>
                    <small>Updated {date(v.mileage_updated_at)}</small>
                  </div>
                  <button className="text-btn" onClick={() => setMileage(v)}>
                    Update <ArrowUpRight size={14} />
                  </button>
                </div>
                <div className="vehicle-actions">
                  <button
                    className="btn secondary"
                    onClick={() => setDetail(v)}
                  >
                    View history
                  </button>
                  <button className="btn primary" onClick={() => p.nav("book")}>
                    Book service <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Make room for your first vehicle"
          text="Add your vehicle to start building its service story."
          action={
            <button className="btn primary" onClick={() => setAdd(true)}>
              Add vehicle
            </button>
          }
        />
      )}
      {add && (
        <VehicleForm
          onClose={() => setAdd(false)}
          onSaved={() => p.changed("Vehicle added to your garage.")}
        />
      )}
      {mileage && (
        <MileageModal
          vehicle={mileage}
          onClose={() => setMileage(null)}
          changed={p.changed}
        />
      )}
      {detail && (
        <VehicleHistory
          vehicle={detail}
          onClose={() => setDetail(null)}
          rev={p.rev}
        />
      )}
      {edit && (
        <Modal
          title="Edit vehicle details"
          subtitle={edit.registration}
          onClose={() => setEdit(null)}
        >
          <DataForm
            onClose={() => setEdit(null)}
            onSubmit={async (f) => {
              await api(`vehicles/${edit.id}`, "PATCH", {
                make: val(f, "make"),
                model: val(f, "model"),
                modelYear: Number(val(f, "modelYear")),
              });
              p.changed("Vehicle details updated.");
              setEdit(null);
            }}
          >
            <Field label="Make">
              <input
                name="make"
                required
                maxLength={60}
                defaultValue={edit.make}
              />
            </Field>
            <Field label="Model">
              <input
                name="model"
                required
                maxLength={60}
                defaultValue={edit.model}
              />
            </Field>
            <Field label="Model year">
              <input
                name="modelYear"
                type="number"
                min={1900}
                max={2100}
                required
                defaultValue={edit.model_year}
              />
            </Field>
            <p className="muted">
              Registration and ownership stay fixed. Use Update mileage to
              record a new odometer reading.
            </p>
          </DataForm>
        </Modal>
      )}
    </>
  );
}
function VehicleHistory({
  vehicle,
  onClose,
  rev,
}: {
  vehicle: Row;
  onClose: () => void;
  rev: number;
}) {
  const r = useResource(`vehicles/${vehicle.id}/history`, rev);
  return (
    <Modal
      title={`${vehicle.make} ${vehicle.model}`}
      subtitle={`${vehicle.registration} · Completed service history`}
      onClose={onClose}
      wide
    >
      {r.loading ? (
        <Loader />
      ) : r.error ? (
        <ErrorPanel message={r.error} />
      ) : r.data.length ? (
        <div className="history-timeline">
          {r.data.map((b: Row) => (
            <article key={b.id}>
              <div className="timeline-dot" />
              <small>{date(b.completed_at, true)}</small>
              <h3>{b.service_name}</h3>
              <p>{b.summary}</p>
              <div className="timeline-meta">
                <span>
                  <MapPin size={14} />
                  {b.centre_name}
                </span>
                <span>
                  <Gauge size={14} />
                  {number(b.odometer_km)} km
                </span>
                <b>{money(b.total)}</b>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="A fresh service story"
          text="Completed services will be recorded here."
        />
      )}
    </Modal>
  );
}
function BookService(p: Props) {
  const vehicles = useResource("vehicles?pageSize=100", p.rev),
    [search, setSearch] = useState(""),
    centres = useResource(
      `centres?search=${encodeURIComponent(search)}`,
      p.rev,
    ),
    [centre, setCentre] = useState<Row | null>(null),
    [chosenVehicle, setChosenVehicle] = useState(""),
    [service, setService] = useState(""),
    [day, setDay] = useState(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(Date.now() + 86400000)),
    ),
    [slot, setSlot] = useState<Row | null>(null),
    [success, setSuccess] = useState<Row | null>(null);
  const slots = useResource(
    centre ? `centres/${centre.id}/slots?date=${day}` : "centres",
    p.rev,
  );
  const request = useRef<{ signature: string; key: string }>({
    signature: "",
    key: "",
  });
  useEffect(() => {
    if (vehicles.data?.items.length && !chosenVehicle)
      setChosenVehicle(vehicles.data.items[0].id);
  }, [vehicles.data, chosenVehicle]);
  useEffect(() => {
    if (p.catalogue.services.length && !service)
      setService(p.catalogue.services[0].id);
  }, [p.catalogue, service]);
  const v = vehicles.data?.items.find((x: Row) => x.id === chosenVehicle);
  if (success)
    return (
      <>
        <Heading
          eyebrow="YOU’RE ALL SET"
          title="Your next service is booked."
          text="A little planning today. A smoother journey tomorrow."
        />
        <div className="booking-success panel">
          <span className="success-icon">
            <CheckCircle2 size={46} />
          </span>
          <h2>See you at {centre?.name}.</h2>
          <p>
            {date(slot!.starts_at, true)} · {time(slot!.starts_at)} –{" "}
            {time(slot!.ends_at)}
          </p>
          <span className="plate">{v?.registration}</span>
          <div className="success-ref">
            Booking reference <b>{success.id.slice(0, 8).toUpperCase()}</b>
          </div>
          <p className="muted">
            This is your arrival window. Service duration depends on the work
            required.
          </p>
          <button className="btn primary" onClick={() => p.nav("bookings")}>
            View my bookings <ArrowRight size={16} />
          </button>
        </div>
      </>
    );
  return (
    <>
      <Heading
        eyebrow="YOUR NEXT STOP, SORTED"
        title="Book a service."
        text="Find your centre. Pick a time. We’ll keep the rest connected."
      />
      <div className="booking-layout">
        <div>
          <div className="steps">
            <span className="done">
              <i>1</i>Your vehicle
            </span>
            <span className={centre ? "done" : ""}>
              <i>2</i>Service centre
            </span>
            <span className={slot ? "done" : ""}>
              <i>3</i>Arrival time
            </span>
          </div>
          <section className="panel booking-section">
            <SectionTitle title="01. Choose your vehicle & service" />
            {vehicles.loading ? (
              <Loader />
            ) : vehicles.error ? (
              <ErrorPanel message={vehicles.error} />
            ) : !vehicles.data.items.length ? (
              <Empty
                title="Add a vehicle first"
                text="Your booking needs a vehicle from your garage."
                action={
                  <button
                    className="btn primary"
                    onClick={() => p.nav("garage")}
                  >
                    Open my garage
                  </button>
                }
              />
            ) : (
              <div className="form-grid">
                <Field label="Vehicle">
                  <select
                    value={chosenVehicle}
                    onChange={(e) => setChosenVehicle(e.target.value)}
                  >
                    {vehicles.data.items.map((x: Row) => (
                      <option key={x.id} value={x.id}>
                        {x.make} {x.model} · {x.registration}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Requested service">
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                  >
                    {p.catalogue.services.map((s: Row) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </section>
          <section className="panel booking-section">
            <SectionTitle title="02. Find your service centre" />
            <div className="search-box">
              <Search size={17} />
              <input
                aria-label="Search centres"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by centre or city…"
              />
            </div>
            {centres.error ? (
              <ErrorPanel message={centres.error} />
            ) : centres.loading ? (
              <Loader />
            ) : centres.data.length ? (
              <div className="centre-options">
                {centres.data.map((c: Row) => (
                  <button
                    key={c.id}
                    className={`centre-option ${centre?.id === c.id ? "chosen" : ""}`}
                    onClick={() => {
                      setCentre(c);
                      setSlot(null);
                    }}
                  >
                    <span className="centre-icon">
                      <Building2 size={22} />
                    </span>
                    <span>
                      <b>{c.name}</b>
                      <small>
                        <MapPin size={13} />
                        {c.address}, {c.city}
                      </small>
                      <em>{c.phone}</em>
                    </span>
                    <span className="radio-check">
                      {centre?.id === c.id && <Check size={12} />}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="No centres found"
                text="Try another name or city."
              />
            )}
          </section>
          <section className="panel booking-section">
            <SectionTitle title="03. Pick an arrival window" />
            {!centre ? (
              <p className="inline-note">
                Choose a centre above to see available arrival times.
              </p>
            ) : (
              <>
                <Field label="Arrival date">
                  <input
                    type="date"
                    value={day}
                    min={today()}
                    onChange={(e) => {
                      setDay(e.target.value);
                      setSlot(null);
                    }}
                    required
                  />
                </Field>
                {slots.loading ? (
                  <Loader />
                ) : slots.error ? (
                  <ErrorPanel message={slots.error} />
                ) : slots.data.length ? (
                  <div className="slot-grid">
                    {slots.data.map((s: Row) => (
                      <button
                        key={s.id}
                        disabled={s.remaining <= 0}
                        className={`slot-option ${slot?.id === s.id ? "chosen" : ""}`}
                        onClick={() => setSlot(s)}
                      >
                        <Clock3 size={15} />
                        <b>{time(s.starts_at)}</b>
                        <small>
                          {s.remaining > 0
                            ? `${s.remaining} spaces left`
                            : "Fully booked"}
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="No slots on this date"
                    text="Choose another date. Demo availability covers the next seven days."
                  />
                )}
              </>
            )}
          </section>
        </div>
        <aside className="booking-summary panel">
          <div className="summary-icon">
            <CalendarDays size={25} />
          </div>
          <h2>Your service plan</h2>
          <p>A clear plan before you confirm.</p>
          {v && (
            <div className="summary-vehicle">
              <CarArt />
              <b>
                {v.make} {v.model}
              </b>
              <span className="plate">{v.registration}</span>
            </div>
          )}
          <dl>
            <div>
              <dt>Service</dt>
              <dd>
                {p.catalogue.services.find((s: Row) => s.id === service)
                  ?.name || "Select a service"}
              </dd>
            </div>
            <div>
              <dt>Centre</dt>
              <dd>{centre?.name || "Choose a centre"}</dd>
            </div>
            <div>
              <dt>Arrival</dt>
              <dd>
                {slot
                  ? `${date(slot.starts_at)} · ${time(slot.starts_at)}`
                  : "Choose a time"}
              </dd>
            </div>
            <div>
              <dt>Charges</dt>
              <dd>Recorded after service</dd>
            </div>
          </dl>
          <DataForm
            label="Confirm booking"
            onSubmit={async (f) => {
              if (!slot || !centre || !chosenVehicle || !service)
                throw new Error(
                  "Choose a vehicle, service centre, and available arrival time.",
                );
              const payload = {
                vehicleId: chosenVehicle,
                slotId: slot.id,
                serviceTypeId: service,
                complaint: val(f, "complaint"),
              };
              const signature = JSON.stringify(payload);
              if (request.current.signature !== signature)
                request.current = { signature, key: crypto.randomUUID() };
              const b = await api("bookings", "POST", {
                ...payload,
                requestKey: request.current.key,
              });
              setSuccess(b);
              p.changed("Your booking is confirmed.");
            }}
          >
            <Field label="What should the team know?">
              <textarea
                name="complaint"
                rows={3}
                maxLength={2000}
                required
                placeholder="Service needs, symptoms, or anything to check…"
              />
            </Field>
          </DataForm>
          <div className="summary-note">
            <ShieldCheck size={16} />
            <span>
              Instant confirmation. Cancel before your arrival window starts.
            </span>
          </div>
        </aside>
      </div>
    </>
  );
}
function Bookings(p: Props & { history?: boolean }) {
  const [status, setStatus] = useState(p.history ? "COMPLETED" : ""),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<string | null>(null),
    [dateFilter, setDateFilter] = useState("");
  const path = `bookings?page=${page}&pageSize=12${status ? `&status=${status}` : ""}${dateFilter ? `&date=${dateFilter}` : ""}`;
  const r = useResource(path, p.rev);
  const rows =
    r.data?.items.filter((b: Row) =>
      `${b.registration} ${b.service_name} ${b.centre_name} ${b.customer_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) ?? [];
  return (
    <>
      <Heading
        eyebrow={
          p.history
            ? "YOUR VEHICLE’S STORY"
            : p.user.role === "STAFF"
              ? "EVERY ARRIVAL, ACCOUNTED FOR"
              : "A LITTLE PLANNING GOES FAR"
        }
        title={
          p.history
            ? "Service history."
            : p.user.role === "STAFF"
              ? "Your work queue."
              : "Your bookings."
        }
        text={
          p.history
            ? "A dependable record of every service, across your centres."
            : p.user.role === "STAFF"
              ? "Manage arrivals, inspections, and completed work for your centre."
              : "Keep track of your next service and every visit along the way."
        }
        action={
          p.user.role === "CUSTOMER" && !p.history ? (
            <button className="btn primary" onClick={() => p.nav("book")}>
              <Plus size={18} />
              Book a service
            </button>
          ) : undefined
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search bookings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle, service, or centre…"
            />
          </div>
          <div className="table-filters">
            {!p.history && (
              <select
                aria-label="Filter booking status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All statuses</option>
                {[
                  "CONFIRMED",
                  "IN_PROGRESS",
                  "COMPLETED",
                  "CANCELLED",
                  "NO_SHOW",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ").toLowerCase()}
                  </option>
                ))}
              </select>
            )}
            <input
              aria-label="Filter arrival date"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
            />
            {dateFilter && (
              <button
                className="icon-btn"
                aria-label="Clear date filter"
                onClick={() => setDateFilter("")}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        {r.loading ? (
          <Loader />
        ) : r.error ? (
          <ErrorPanel message={r.error} retry={r.retry} />
        ) : rows.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle & service</th>
                    <th>
                      {p.user.role === "STAFF" ? "Customer" : "Service centre"}
                    </th>
                    <th>Arrival</th>
                    <th>Status</th>
                    <th>Charges</th>
                    <th>
                      <span className="sr-only">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b: Row) => (
                    <tr key={b.id}>
                      <td>
                        <div className="table-primary">
                          <span className="table-icon">
                            <Car size={18} />
                          </span>
                          <span>
                            <b>
                              {b.make} {b.model}
                            </b>
                            <small>
                              {b.registration} · {b.service_name}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <b className="table-normal">
                          {p.user.role === "STAFF"
                            ? b.customer_name
                            : b.centre_name}
                        </b>
                        <small className="cell-small">
                          #{b.id.slice(0, 8).toUpperCase()}
                        </small>
                      </td>
                      <td>
                        <b className="table-normal">
                          {date(b.starts_at, true)}
                        </b>
                        <small className="cell-small">
                          {time(b.starts_at)}
                        </small>
                      </td>
                      <td>
                        <Badge status={b.status} />
                      </td>
                      <td>
                        <b className="table-normal">
                          {b.total !== null ? money(b.total) : "—"}
                        </b>
                      </td>
                      <td>
                        <button
                          className="btn secondary small"
                          onClick={() => setSelected(b.id)}
                        >
                          Details <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                {r.data.total} bookings · Page {page}
              </span>
              <div>
                <button
                  className="icon-btn"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Next page"
                  disabled={page * 12 >= r.data.total}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="No matching bookings"
            text={
              p.history
                ? "Completed services will appear here."
                : "Try another filter or create your next booking."
            }
          />
        )}
      </section>
      {selected && (
        <BookingDetail id={selected} {...p} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
function BookingDetail(p: Props & { id: string; onClose: () => void }) {
  const r = useResource(`bookings/${p.id}`, p.rev),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false),
    [tab, setTab] = useState("details");
  const act = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      await api(`bookings/${p.id}/${action}`, "POST", {});
      p.changed(
        action === "cancel" ? "Booking cancelled." : "Booking updated.",
      );
      setCancel(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const b = r.data;
  return (
    <Modal
      title={b ? `${b.make} ${b.model}` : "Booking details"}
      subtitle={
        b ? `${b.registration} · #${b.id.slice(0, 8).toUpperCase()}` : undefined
      }
      onClose={p.onClose}
      wide
    >
      {r.loading && !b ? (
        <Loader />
      ) : r.error ? (
        <ErrorPanel message={r.error} />
      ) : (
        b && (
          <>
            <div className="detail-banner">
              <div>
                <Badge status={b.status} />
                <h3>{b.service_name}</h3>
                <p>
                  <MapPin size={14} />
                  {b.centre_name} <span>·</span> {date(b.starts_at, true)} ·{" "}
                  {time(b.starts_at)}
                </p>
              </div>
              <span className="detail-amount">
                {b.total !== null ? money(b.total) : "Awaiting service"}
              </span>
            </div>
            <div className="detail-tabs">
              {[
                "details",
                ...(p.user.role === "STAFF" || b.status === "COMPLETED"
                  ? ["inspection"]
                  : []),
                ...(p.user.role === "STAFF" && b.status === "IN_PROGRESS"
                  ? ["complete"]
                  : []),
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={tab === t ? "active" : ""}
                >
                  {t === "complete"
                    ? "Complete service"
                    : t === "inspection"
                      ? "Inspection"
                      : "Job details"}
                </button>
              ))}
            </div>
            {tab === "inspection" ? (
              <InspectionEditor booking={b} user={p.user} changed={p.changed} />
            ) : tab === "complete" ? (
              <CompleteForm
                booking={b}
                catalogue={p.catalogue}
                onDone={() => {
                  p.changed(
                    "Service completed. History and maintenance are updated.",
                  );
                  setTab("details");
                }}
              />
            ) : (
              <div className="detail-body">
                <div className="detail-grid">
                  <div>
                    <span className="eyebrow">CUSTOMER CONCERN</span>
                    <p>{b.complaint}</p>
                  </div>
                  <div>
                    <span className="eyebrow">VEHICLE INFORMATION</span>
                    <p>
                      {number(b.current_km)} km current mileage
                      <br />
                      {b.customer_name}
                    </p>
                  </div>
                </div>
                {b.summary && (
                  <>
                    <h3>Completed work</h3>
                    <p>{b.summary}</p>
                    <div className="item-list">
                      {b.items.map((i: Row) => (
                        <div key={i.id}>
                          <span>
                            <b>{i.description}</b>
                            <small>
                              {i.service_name}
                              {i.fault_label ? ` · ${i.fault_label}` : ""}
                            </small>
                          </span>
                          <span>
                            {i.quantity} × {money(i.unit_price)}
                          </span>
                          <b>
                            {money(Number(i.quantity) * Number(i.unit_price))}
                          </b>
                        </div>
                      ))}
                    </div>
                    <p className="muted">
                      Completed {date(b.completed_at, true)} at{" "}
                      {number(b.odometer_km)} km. Recorded charges are not a
                      payment receipt.
                    </p>
                  </>
                )}
                <h3 className="audit-title">Booking timeline</h3>
                <div className="audit-list">
                  {b.history.map((h: Row) => (
                    <div key={h.id}>
                      <span className="audit-dot" />
                      <div>
                        <b>{h.to_status.replaceAll("_", " ").toLowerCase()}</b>
                        <small>
                          {h.actor_name} · {date(h.changed_at)} ·{" "}
                          {time(h.changed_at)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                {cancel ? (
                  <div className="cancel-confirm">
                    <p>
                      Cancel this booking? Your reserved space will be released.
                    </p>
                    <button
                      className="btn secondary small"
                      onClick={() => setCancel(false)}
                    >
                      Keep booking
                    </button>
                    <button
                      className="btn danger small"
                      disabled={busy}
                      onClick={() => act("cancel")}
                    >
                      {busy ? "Cancelling…" : "Confirm cancellation"}
                    </button>
                  </div>
                ) : (
                  <div className="detail-actions">
                    {b.status === "CONFIRMED" &&
                      new Date(b.starts_at) > new Date() && (
                        <button
                          className="btn secondary"
                          onClick={() => setCancel(true)}
                        >
                          Cancel booking
                        </button>
                      )}
                    {p.user.role === "STAFF" &&
                      b.status === "CONFIRMED" &&
                      new Date(b.starts_at) <= new Date() && (
                        <button
                          className="btn primary"
                          disabled={busy}
                          onClick={() => act("start")}
                        >
                          <Wrench size={16} />
                          Start service
                        </button>
                      )}
                    {p.user.role === "STAFF" &&
                      b.status === "CONFIRMED" &&
                      Date.now() >= Date.parse(b.starts_at) + 1800000 && (
                        <button
                          className="btn secondary"
                          disabled={busy}
                          onClick={() => act("no-show")}
                        >
                          Mark no-show
                        </button>
                      )}
                    {p.user.role === "STAFF" && b.status === "IN_PROGRESS" && (
                      <button
                        className="btn primary"
                        onClick={() => setTab("complete")}
                      >
                        Complete service <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )
      )}
    </Modal>
  );
}
function InspectionEditor({
  booking,
  user,
  changed,
}: {
  booking: Row;
  user: User;
  changed: Props["changed"];
}) {
  const r = useResource(`bookings/${booking.id}/inspection`),
    [items, setItems] = useState<Row[]>([
      { component: "brakes", result: "PASS", comment: "", measurements: [] },
    ]),
    [notes, setNotes] = useState(""),
    [revision, setRevision] = useState(0),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (r.data) {
      setItems(r.data.items);
      setNotes(r.data.diagnostic_notes || "");
      setRevision(r.data.revision);
    }
  }, [r.data]);
  const editable = user.role === "STAFF" && booking.status === "IN_PROGRESS";
  const update = (i: number, key: string, value: unknown) => {
    setSaved(false);
    setItems((old) =>
      old.map((x, j) => (i === j ? { ...x, [key]: value } : x)),
    );
  };
  if (r.loading) return <Loader />;
  if (r.error) return <ErrorPanel message={r.error} retry={r.retry} />;
  if (!editable && !r.data)
    return (
      <Empty
        title="No inspection was saved"
        text="The service record remains available in job details."
      />
    );
  return (
    <DataForm
      label={editable ? "Save inspection" : "Refresh inspection"}
      onSubmit={async () => {
        if (!editable) {
          r.retry();
          return;
        }
        try {
          const doc = await api(`bookings/${booking.id}/inspection`, "PUT", {
            revision,
            items,
            diagnosticNotes: notes,
          });
          setRevision(doc.revision);
          setSaved(true);
          changed("Inspection saved.");
        } catch (e) {
          throw e;
        }
      }}
    >
      {saved && (
        <div className="notice" role="status">
          <CheckCircle2 size={18} />
          Inspection saved. Revision {revision}.
        </div>
      )}
      <div className="notice">
        <ClipboardCheck size={18} />
        <span>
          {editable
            ? "Record what you find. Inspection notes save separately from the completed service."
            : `Saved inspection · revision ${revision}`}
        </span>
      </div>
      {items.map((item, i) => (
        <div className="inspection-item" key={i}>
          <div className="form-grid">
            <Field label={`Component ${i + 1}`}>
              <input
                aria-label={`Component ${i + 1}`}
                value={item.component}
                disabled={!editable}
                maxLength={100}
                required
                onChange={(e) => update(i, "component", e.target.value)}
              />
            </Field>
            <Field label="Result">
              <select
                value={item.result}
                disabled={!editable}
                onChange={(e) => update(i, "result", e.target.value)}
              >
                {["PASS", "ATTENTION", "FAIL"].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Notes">
            <input
              value={item.comment}
              disabled={!editable}
              maxLength={1000}
              onChange={(e) => update(i, "comment", e.target.value)}
              placeholder="Observations for this component"
            />
          </Field>
          <div className="measurements">
            {(item.measurements || []).map((m: Row, j: number) => (
              <div className="measurement-row" key={j}>
                <input
                  aria-label="Measurement name"
                  placeholder="Measurement"
                  value={m.name}
                  disabled={!editable}
                  required
                  onChange={(e) =>
                    update(
                      i,
                      "measurements",
                      item.measurements.map((x: Row, k: number) =>
                        j === k ? { ...x, name: e.target.value } : x,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Measurement value"
                  type="number"
                  step="any"
                  value={m.value}
                  disabled={!editable}
                  required
                  onChange={(e) =>
                    update(
                      i,
                      "measurements",
                      item.measurements.map((x: Row, k: number) =>
                        j === k ? { ...x, value: Number(e.target.value) } : x,
                      ),
                    )
                  }
                />
                <input
                  aria-label="Measurement unit"
                  placeholder="Unit"
                  value={m.unit}
                  disabled={!editable}
                  required
                  onChange={(e) =>
                    update(
                      i,
                      "measurements",
                      item.measurements.map((x: Row, k: number) =>
                        j === k ? { ...x, unit: e.target.value } : x,
                      ),
                    )
                  }
                />
                {editable && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Remove measurement"
                    onClick={() =>
                      update(
                        i,
                        "measurements",
                        item.measurements.filter(
                          (_: Row, k: number) => k !== j,
                        ),
                      )
                    }
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && (
            <div className="inspection-actions">
              <button
                type="button"
                className="text-btn"
                disabled={(item.measurements?.length || 0) >= 20}
                onClick={() =>
                  update(i, "measurements", [
                    ...(item.measurements || []),
                    { name: "", value: 0, unit: "" },
                  ])
                }
              >
                <Plus size={13} />
                Add measurement
              </button>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-btn danger-text"
                  onClick={() =>
                    setItems((old) => old.filter((_, j) => i !== j))
                  }
                >
                  Remove component
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      {editable && (
        <button
          type="button"
          disabled={items.length >= 50}
          className="btn secondary small"
          onClick={() =>
            setItems([
              ...items,
              { component: "", result: "PASS", comment: "", measurements: [] },
            ])
          }
        >
          <Plus size={15} />
          Add component
        </button>
      )}
      <Field label="Diagnostic notes">
        <textarea
          rows={3}
          value={notes}
          disabled={!editable}
          maxLength={5000}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
        />
      </Field>
      <button type="button" className="text-btn" onClick={r.retry}>
        <RefreshCw size={13} />
        Reload saved inspection
      </button>
    </DataForm>
  );
}
function CompleteForm({
  booking,
  catalogue,
  onDone,
}: {
  booking: Row;
  catalogue: Row;
  onDone: () => void;
}) {
  const [items, setItems] = useState<Row[]>([
    {
      serviceTypeId: booking.requested_service_type_id,
      description: "",
      quantity: 1,
      unitPrice: "",
      faultCode: "",
    },
  ]);
  const update = (i: number, key: string, value: unknown) =>
    setItems((old) =>
      old.map((x, j) => (i === j ? { ...x, [key]: value } : x)),
    );
  return (
    <DataForm
      label="Complete & save service"
      onSubmit={async (f) => {
        await api(`bookings/${booking.id}/complete`, "POST", {
          odometerKm: Number(val(f, "odometerKm")),
          summary: val(f, "summary"),
          items,
        });
        onDone();
      }}
    >
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Completion saves the record, charges, mileage, and booking state
          together. Completed work cannot be edited.
        </span>
      </div>
      <Field
        label="Completion mileage (km)"
        hint={`Current recorded mileage: ${number(booking.current_km)} km`}
      >
        <input
          name="odometerKm"
          type="number"
          min={booking.current_km}
          max={2147483647}
          defaultValue={booking.current_km}
          required
        />
      </Field>
      <Field label="Work summary">
        <textarea
          name="summary"
          rows={3}
          required
          maxLength={5000}
          placeholder="Describe the work completed and any recommendations…"
        />
      </Field>
      <h3>Service items</h3>
      {items.map((item, i) => (
        <div className="inspection-item" key={i}>
          <div className="form-grid">
            <Field label="Service type">
              <select
                value={item.serviceTypeId}
                onChange={(e) => update(i, "serviceTypeId", e.target.value)}
              >
                {catalogue.services.map((s: Row) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fault code (optional)">
              <select
                value={item.faultCode}
                onChange={(e) => update(i, "faultCode", e.target.value)}
              >
                <option value="">No fault recorded</option>
                {catalogue.faults.map((f: Row) => (
                  <option key={f.code} value={f.code}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Item description">
            <input
              value={item.description}
              required
              maxLength={500}
              onChange={(e) => update(i, "description", e.target.value)}
              placeholder="e.g. Engine oil and filter replaced"
            />
          </Field>
          <div className="form-grid">
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                max={100}
                required
                value={item.quantity}
                onChange={(e) => update(i, "quantity", Number(e.target.value))}
              />
            </Field>
            <Field label="Unit price (₹)">
              <input
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                required
                value={item.unitPrice}
                onChange={(e) => update(i, "unitPrice", e.target.value)}
              />
            </Field>
          </div>
          {items.length > 1 && (
            <button
              type="button"
              className="text-btn danger-text"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
            >
              Remove item
            </button>
          )}
        </div>
      ))}
      <button
        className="btn secondary small"
        type="button"
        disabled={items.length >= 50}
        onClick={() =>
          setItems([
            ...items,
            {
              serviceTypeId: catalogue.services[0]?.id,
              description: "",
              quantity: 1,
              unitPrice: "",
              faultCode: "",
            },
          ])
        }
      >
        <Plus size={15} />
        Add service item
      </button>
      <div className="completion-total">
        <span>Total recorded charges</span>
        <b>
          {money(
            items.reduce(
              (n, x) => n + Number(x.unitPrice || 0) * Number(x.quantity || 0),
              0,
            ),
          )}
        </b>
      </div>
    </DataForm>
  );
}
function Maintenance(p: Props) {
  const r = useResource("maintenance", p.rev),
    vehicles = useResource("vehicles?pageSize=100", p.rev),
    [rule, setRule] = useState<Row | null>(null),
    [filter, setFilter] = useState("");
  const rules =
    r.data?.rules.filter((x: Row) => !filter || x.vehicle_id === filter) ?? [];
  return (
    <>
      <Heading
        eyebrow="CARE THAT COMES WITH CONTEXT"
        title="Stay ahead of maintenance."
        text="Date, mileage, and service history. Clear reasons behind every reminder."
        action={
          <button className="btn primary" onClick={() => setRule({})}>
            <Plus size={18} />
            Set maintenance rule
          </button>
        }
      />
      <div className="notice maintenance-notice">
        <Sparkles size={20} />
        <span>
          These reminders use configurable rules and recorded mileage. Demo
          intervals are examples; set intervals appropriate to your vehicle’s
          service guidance.
        </span>
      </div>
      <div className="section-title">
        <h2>Your maintenance plan</h2>
        <select
          aria-label="Filter maintenance by vehicle"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All vehicles</option>
          {vehicles.data?.items.map((v: Row) => (
            <option key={v.id} value={v.id}>
              {v.make} {v.model} · {v.registration}
            </option>
          ))}
        </select>
      </div>
      {r.loading ? (
        <Loader />
      ) : r.error ? (
        <ErrorPanel message={r.error} retry={r.retry} />
      ) : rules.length ? (
        <div className="maintenance-grid">
          {rules.map((m: Row) => (
            <section className="panel maintenance-card" key={m.id}>
              <div className="maintenance-card-top">
                <span
                  className={`maintenance-symbol ${m.status === "DUE" ? "amber" : "green"}`}
                >
                  <Wrench size={22} />
                </span>
                <Badge status={m.status} />
              </div>
              <h2>{m.service_name}</h2>
              <p className="muted">
                {m.make} {m.model} · {m.registration}
              </p>
              <div className="rule-thresholds">
                {m.interval_months && (
                  <div>
                    <span>Next due date</span>
                    <b>
                      {m.dueDate
                        ? date(m.dueDate + "T00:00:00+05:30", true)
                        : "Baseline needed"}
                    </b>
                    <small>
                      {m.daysRemaining !== null
                        ? `${Math.abs(m.daysRemaining)} days ${m.daysRemaining <= 0 ? "past threshold" : "remaining"}`
                        : "Add last service date"}
                    </small>
                  </div>
                )}
                {m.interval_km && (
                  <div>
                    <span>Next due mileage</span>
                    <b>
                      {m.dueKm !== null
                        ? `${number(m.dueKm)} km`
                        : "Baseline needed"}
                    </b>
                    <small>
                      {m.kmRemaining !== null
                        ? `${number(Math.abs(m.kmRemaining))} km ${m.kmRemaining <= 0 ? "past threshold" : "remaining"}`
                        : "Add last service mileage"}
                    </small>
                  </div>
                )}
              </div>
              <div className="rule-evidence">
                <BookOpen size={15} />
                <span>
                  {m.baselineSource === "completed_service"
                    ? "Based on your last completed service"
                    : "Based on your initial service baseline"}
                  {m.baselineDate
                    ? ` · ${date(m.baselineDate + "T00:00:00+05:30")}`
                    : ""}
                </span>
              </div>
              {(m.missingDate || m.missingMileage) && (
                <p className="warning-text">
                  <AlertTriangle size={14} />
                  Part of this rule needs more service history.
                </p>
              )}
              {m.mileageStale && (
                <p className="warning-text">
                  <Gauge size={14} />
                  Mileage is over 30 days old. Update your reading.
                </p>
              )}
              <div className="maintenance-card-actions">
                <button className="text-btn" onClick={() => setRule(m)}>
                  <Settings2 size={14} />
                  Edit rule
                </button>
                <button className="text-btn" onClick={() => p.nav("book")}>
                  Book service <ArrowRight size={14} />
                </button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Build a maintenance plan"
          text="Set a time or mileage interval for a service and vehicle."
          action={
            <button className="btn primary" onClick={() => setRule({})}>
              Add a rule
            </button>
          }
        />
      )}
      <section className="panel recurring-panel">
        <SectionTitle
          title="Patterns worth a closer look"
          sub="The same fault recorded in two or more distinct services within 180 days."
        />
        {r.data?.faults.filter((f: Row) => !filter || f.vehicle_id === filter)
          .length ? (
          <div className="fault-list">
            {r.data.faults
              .filter((f: Row) => !filter || f.vehicle_id === filter)
              .map((f: Row) => (
                <div className="fault-item" key={`${f.vehicle_id}-${f.code}`}>
                  <span className="mini-icon amber">
                    <AlertTriangle size={19} />
                  </span>
                  <div>
                    <b>{f.label}</b>
                    <p>
                      {f.registration} · {f.occurrences} services · Latest{" "}
                      {date(f.latest_occurrence, true)}
                    </p>
                    <small>Repeated issue recorded; consider inspection.</small>
                    <div className="fault-evidence">
                      {f.evidence.map((e: Row) => (
                        <span key={e.recordId}>
                          #{e.bookingId.slice(0, 8).toUpperCase()} ·{" "}
                          {date(e.date)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="clear-state">
            <CheckCircle2 size={20} />
            <span>
              No recurring faults found in the available service history.
            </span>
          </div>
        )}
      </section>
      {rule && (
        <RuleModal
          {...p}
          rule={rule}
          vehicles={vehicles.data?.items ?? []}
          rules={r.data?.rules ?? []}
          onClose={() => setRule(null)}
        />
      )}
    </>
  );
}
function RuleModal(
  p: Props & { rule: Row; vehicles: Row[]; rules: Row[]; onClose: () => void },
) {
  const [vehicle, setVehicle] = useState(
      p.rule.vehicle_id || p.vehicles[0]?.id || "",
    ),
    [service, setService] = useState(
      p.rule.service_type_id || p.catalogue.services[0]?.id || "",
    );
  const existing = p.rules.find(
    (r) => r.vehicle_id === vehicle && r.service_type_id === service,
  );
  return (
    <Modal
      title="Maintenance rule"
      subtitle="Set your intervals and, if known, the last service baseline."
      onClose={p.onClose}
    >
      <div className="rule-selectors form-grid">
        <Field label="Vehicle">
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            {p.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} · {v.registration}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select value={service} onChange={(e) => setService(e.target.value)}>
            {p.catalogue.services.map((s: Row) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <DataForm
        key={`${vehicle}-${service}`}
        label="Save maintenance rule"
        onClose={p.onClose}
        onSubmit={async (f) => {
          if (!vehicle) throw new Error("Add a vehicle to your garage first.");
          await api(`vehicles/${vehicle}/maintenance-rules`, "PUT", {
            serviceTypeId: service,
            intervalMonths: nullableNumber(f, "months"),
            intervalKm: nullableNumber(f, "km"),
            baselineDate: val(f, "baselineDate") || null,
            baselineKm: nullableNumber(f, "baselineKm"),
          });
          p.changed("Maintenance rule saved.");
          p.onClose();
        }}
      >
        <p className="muted">
          Enter a time interval, a mileage interval, or both. Maintenance is due
          when either known threshold is reached.
        </p>
        <div className="form-grid">
          <Field label="Interval (months)">
            <input
              name="months"
              type="number"
              min={1}
              max={120}
              defaultValue={existing?.interval_months ?? ""}
              placeholder="e.g. 6"
            />
          </Field>
          <Field label="Interval (km)">
            <input
              name="km"
              type="number"
              min={1}
              max={1000000}
              defaultValue={existing?.interval_km ?? ""}
              placeholder="e.g. 5000"
            />
          </Field>
          <Field label="Initial last service date">
            <input
              name="baselineDate"
              type="date"
              max={today()}
              defaultValue={existing?.baseline_date?.slice(0, 10) ?? ""}
            />
          </Field>
          <Field label="Initial last service mileage">
            <input
              name="baselineKm"
              type="number"
              min={0}
              max={p.vehicles.find((v) => v.id === vehicle)?.current_km}
              defaultValue={existing?.baseline_km ?? ""}
              placeholder="Leave blank if unknown"
            />
          </Field>
        </div>
        <div className="notice">
          <BookOpen size={18} />
          <span>
            Completed matching services automatically become the latest
            baseline. Unknown history stays unknown.
          </span>
        </div>
      </DataForm>
    </Modal>
  );
}
function Slots(p: Props) {
  const r = useResource("slots", p.rev),
    [modal, setModal] = useState<Row | null>(null),
    [remove, setRemove] = useState<Row | null>(null),
    [filter, setFilter] = useState("");
  const rows =
    r.data?.filter(
      (s: Row) =>
        !filter ||
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kolkata",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(s.starts_at)) === filter,
    ) ?? [];
  return (
    <>
      <Heading
        eyebrow="MAKE ROOM FOR GOOD SERVICE"
        title="Arrival slots."
        text="Publish one-hour arrival windows and set your centre’s capacity."
        action={
          <button className="btn primary" onClick={() => setModal({})}>
            <Plus size={18} />
            Publish slot
          </button>
        }
      />
      <div className="notice">
        <Clock3 size={18} />
        <span>
          Slots start on the hour, 09:00–17:00. A slot can receive 1–20
          vehicles. Referenced slots stay fixed to preserve booking history.
        </span>
      </div>
      <section className="panel">
        <SectionTitle
          title="Upcoming availability"
          sub={p.user.centre_name}
          action={
            <input
              aria-label="Filter slot date"
              type="date"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          }
        />
        {r.loading ? (
          <Loader />
        ) : r.error ? (
          <ErrorPanel message={r.error} retry={r.retry} />
        ) : rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Arrival window</th>
                  <th>Capacity</th>
                  <th>Available</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s: Row) => (
                  <tr key={s.id}>
                    <td>
                      <b>{date(s.starts_at, true)}</b>
                    </td>
                    <td>
                      {time(s.starts_at)} – {time(s.ends_at)}
                    </td>
                    <td>{s.capacity} vehicles</td>
                    <td>
                      <span
                        className={`badge ${s.remaining > 0 ? "up_to_date" : "due"}`}
                      >
                        <i />
                        {s.remaining} spaces
                      </span>
                    </td>
                    <td>
                      {s.booking_count === 0 ? (
                        <div className="inline-actions">
                          <button
                            className="text-btn"
                            onClick={() => setModal(s)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-btn danger-text"
                            onClick={() => setRemove(s)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <span className="muted">Has booking history</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No arrival slots"
            text="Publish availability to let customers book your centre."
          />
        )}
      </section>
      {modal && (
        <Modal
          title={modal.id ? "Edit slot capacity" : "Publish an arrival slot"}
          subtitle="Arrival times use Asia/Kolkata."
          onClose={() => setModal(null)}
        >
          <DataForm
            label={modal.id ? "Save capacity" : "Publish slot"}
            onClose={() => setModal(null)}
            onSubmit={async (f) => {
              if (modal.id)
                await api(`slots/${modal.id}`, "PATCH", {
                  capacity: Number(val(f, "capacity")),
                });
              else
                await api("slots", "POST", {
                  startsAt: new Date(
                    `${val(f, "startsAt")}:00+05:30`,
                  ).toISOString(),
                  capacity: Number(val(f, "capacity")),
                });
              p.changed("Arrival slot saved.");
              setModal(null);
            }}
          >
            {!modal.id && (
              <Field label="Arrival date and time">
                <input
                  name="startsAt"
                  type="datetime-local"
                  step={3600}
                  required
                  defaultValue={`${today()}T10:00`}
                />
              </Field>
            )}
            <Field label="Vehicle capacity">
              <input
                name="capacity"
                type="number"
                min={1}
                max={20}
                required
                defaultValue={modal.capacity || 3}
              />
            </Field>
          </DataForm>
        </Modal>
      )}
      {remove && (
        <Modal
          title="Delete this unused slot?"
          subtitle={`${date(remove.starts_at, true)} · ${time(remove.starts_at)}`}
          onClose={() => setRemove(null)}
        >
          <DataForm
            label="Delete slot"
            onClose={() => setRemove(null)}
            onSubmit={async () => {
              await api(`slots/${remove.id}`, "DELETE");
              p.changed("Unused slot deleted.");
              setRemove(null);
            }}
          >
            <p>Customers will no longer see this arrival window.</p>
          </DataForm>
        </Modal>
      )}
    </>
  );
}
function Centres(p: Props) {
  const r = useResource("admin/centres", p.rev),
    [edit, setEdit] = useState<Row | null>(null),
    [toggle, setToggle] = useState<Row | null>(null);
  return (
    <>
      <Heading
        eyebrow="A NETWORK BUILT ON GOOD CARE"
        title="Service centres."
        text="Manage the places that keep your customers moving."
        action={
          <button className="btn primary" onClick={() => setEdit({})}>
            <Plus size={18} />
            Add service centre
          </button>
        }
      />
      {r.loading ? (
        <Loader />
      ) : r.error ? (
        <ErrorPanel message={r.error} retry={r.retry} />
      ) : (
        <div className="centre-admin-grid">
          {r.data.map((c: Row) => (
            <section key={c.id} className="panel admin-centre">
              <div className="admin-centre-top">
                <span className="centre-icon">
                  <Building2 size={26} />
                </span>
                <span
                  className={`badge ${c.active ? "up_to_date" : "cancelled"}`}
                >
                  <i />
                  {c.active ? "Active" : "Inactive"}
                </span>
              </div>
              <h2>{c.name}</h2>
              <p>
                <MapPin size={15} />
                {c.address}, {c.city}
              </p>
              <p>{c.phone}</p>
              <div className="centre-outstanding">
                <CalendarDays size={16} />
                <span>{c.outstanding_bookings} outstanding bookings</span>
              </div>
              <div className="centre-admin-actions">
                <button
                  className="btn secondary small"
                  onClick={() => setEdit(c)}
                >
                  Edit details
                </button>
                <button className="text-btn" onClick={() => setToggle(c)}>
                  {c.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {edit && (
        <Modal
          title={edit.id ? "Edit service centre" : "Add service centre"}
          onClose={() => setEdit(null)}
        >
          <DataForm
            label={edit.id ? "Save changes" : "Create centre"}
            onClose={() => setEdit(null)}
            onSubmit={async (f) => {
              await api(
                edit.id ? `admin/centres/${edit.id}` : "admin/centres",
                edit.id ? "PATCH" : "POST",
                {
                  name: val(f, "name"),
                  address: val(f, "address"),
                  city: val(f, "city"),
                  phone: val(f, "phone"),
                },
              );
              p.changed("Service centre saved.");
              setEdit(null);
            }}
          >
            <Field label="Centre name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                defaultValue={edit.name}
              />
            </Field>
            <Field label="Street address">
              <textarea
                name="address"
                required
                minLength={3}
                maxLength={300}
                defaultValue={edit.address}
              />
            </Field>
            <div className="form-grid">
              <Field label="City">
                <input
                  name="city"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue={edit.city}
                />
              </Field>
              <Field label="Phone">
                <input
                  name="phone"
                  type="tel"
                  required
                  minLength={6}
                  maxLength={30}
                  defaultValue={edit.phone}
                />
              </Field>
            </div>
          </DataForm>
        </Modal>
      )}
      {toggle && (
        <Modal
          title={`${toggle.active ? "Deactivate" : "Activate"} ${toggle.name}?`}
          onClose={() => setToggle(null)}
        >
          <DataForm
            label={toggle.active ? "Deactivate centre" : "Activate centre"}
            onClose={() => setToggle(null)}
            onSubmit={async () => {
              await api(`admin/centres/${toggle.id}`, "PATCH", {
                active: !toggle.active,
              });
              p.changed("Centre availability updated.");
              setToggle(null);
            }}
          >
            <p>
              {toggle.active
                ? `This centre has ${toggle.outstanding_bookings} outstanding bookings. Existing jobs remain available, but customers cannot make new bookings and staff cannot publish new slots.`
                : "This centre will appear in customer searches and can receive bookings again."}
            </p>
          </DataForm>
        </Modal>
      )}
    </>
  );
}
function Team(p: Props) {
  const r = useResource("admin/staff", p.rev),
    centres = useResource("admin/centres", p.rev),
    [add, setAdd] = useState(false),
    [edit, setEdit] = useState<Row | null>(null),
    [toggle, setToggle] = useState<Row | null>(null);
  return (
    <>
      <Heading
        eyebrow="PEOPLE BEHIND THE SERVICE"
        title="Your service team."
        text="Create centre-specific accounts and keep access in the right hands."
        action={
          <button className="btn primary" onClick={() => setAdd(true)}>
            <Plus size={18} />
            Add team member
          </button>
        }
      />
      <section className="panel">
        {r.loading ? (
          <Loader />
        ) : r.error ? (
          <ErrorPanel message={r.error} retry={r.retry} />
        ) : r.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Team member</th>
                  <th>Assigned centre</th>
                  <th>Access</th>
                  <th>Manage</th>
                </tr>
              </thead>
              <tbody>
                {r.data.map((u: Row) => (
                  <tr key={u.id}>
                    <td>
                      <div className="table-primary">
                        <span className="avatar">
                          {u.name
                            .split(" ")
                            .map((x: string) => x[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <b>{u.name}</b>
                          <small>{u.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>{u.centre_name}</td>
                    <td>
                      <span
                        className={`badge ${u.active ? "up_to_date" : "cancelled"}`}
                      >
                        <i />
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="inline-actions">
                        <button className="text-btn" onClick={() => setEdit(u)}>
                          Edit name
                        </button>
                        <button
                          className="text-btn"
                          onClick={() => setToggle(u)}
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your team starts here"
            text="Add a staff member and assign a centre."
          />
        )}
      </section>
      {add && (
        <Modal
          title="Add a team member"
          subtitle="Each staff account belongs to one centre."
          onClose={() => setAdd(false)}
        >
          <DataForm
            label="Create staff account"
            onClose={() => setAdd(false)}
            onSubmit={async (f) => {
              await api("admin/staff", "POST", {
                name: val(f, "name"),
                email: val(f, "email"),
                password: String(f.get("password")),
                centreId: val(f, "centreId"),
              });
              p.changed("Staff account created.");
              setAdd(false);
            }}
          >
            <Field label="Full name">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Email address">
              <input name="email" type="email" required maxLength={200} />
            </Field>
            <Field
              label="Initial password"
              hint="At least 10 characters; maximum 72 bytes."
            >
              <input
                name="password"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Service centre">
              <select name="centreId" required>
                <option value="">Choose a centre</option>
                {centres.data
                  ?.filter((c: Row) => c.active)
                  .map((c: Row) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </Field>
          </DataForm>
        </Modal>
      )}
      {edit && (
        <Modal title="Edit team member" onClose={() => setEdit(null)}>
          <DataForm
            onClose={() => setEdit(null)}
            onSubmit={async (f) => {
              await api(`admin/staff/${edit.id}`, "PATCH", {
                name: val(f, "name"),
              });
              p.changed("Team member updated.");
              setEdit(null);
            }}
          >
            <Field label="Full name">
              <input
                name="name"
                defaultValue={edit.name}
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
          </DataForm>
        </Modal>
      )}
      {toggle && (
        <Modal
          title={`${toggle.active ? "Deactivate" : "Activate"} ${toggle.name}?`}
          onClose={() => setToggle(null)}
        >
          <DataForm
            label="Confirm change"
            onClose={() => setToggle(null)}
            onSubmit={async () => {
              await api(`admin/staff/${toggle.id}`, "PATCH", {
                active: !toggle.active,
              });
              p.changed("Staff access updated.");
              setToggle(null);
            }}
          >
            <p>
              {toggle.active
                ? "This account will lose access immediately, including existing sessions. Historical work stays recorded."
                : "This staff account will regain access to its assigned centre."}
            </p>
          </DataForm>
        </Modal>
      )}
    </>
  );
}
function Reports(p: Props) {
  const [range, setRange] = useState({ from: "", to: "" }),
    r = useResource(`reports?from=${range.from}&to=${range.to}`, p.rev);
  const d = r.data;
  return (
    <>
      <Heading
        eyebrow="THE BIGGER PICTURE"
        title={
          p.user.role === "CUSTOMER"
            ? "Your care, in perspective."
            : "Service insights."
        }
        text="Understand the work, spending, and patterns behind the numbers."
        action={
          d ? (
            <button
              className="btn secondary"
              onClick={() => {
                const text =
                  "Month,Recorded charges (INR)\n" +
                  d.monthly.map((m: Row) => `${m.month},${m.total}`).join("\n");
                const url = URL.createObjectURL(
                  new Blob([text], { type: "text/csv;charset=utf-8;" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "motive-service-charges.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={17} />
              Export charges
            </button>
          ) : undefined
        }
      />
      <form
        className="report-filters panel"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setRange({ from: val(f, "from"), to: val(f, "to") });
        }}
      >
        <Field label="From date">
          <input type="date" name="from" />
        </Field>
        <Field label="To date">
          <input type="date" name="to" />
        </Field>
        <button className="btn primary" type="submit">
          <Filter size={16} />
          Apply filters
        </button>
      </form>
      {r.loading ? (
        <Loader />
      ) : r.error ? (
        <ErrorPanel message={r.error} retry={r.retry} />
      ) : (
        d && (
          <>
            <div className="stats-grid three">
              <Stat
                label="Recorded service charges"
                value={money(d.totals.charges)}
                icon={IndianRupee}
                detail="Completed services only"
              />
              <Stat
                label="Completed services"
                value={number(d.totals.completed)}
                icon={ShieldCheck}
                detail="Within the selected range"
                color="blue"
              />
              <Stat
                label="Average charge per service"
                value={money(
                  d.totals.completed
                    ? Number(d.totals.charges) / d.totals.completed
                    : 0,
                )}
                icon={TrendingUp}
                detail="Recorded amounts · not payments"
                color="amber"
              />
            </div>
            <section className="panel spending-panel">
              <SectionTitle
                title="Monthly service charges"
                sub="Showing selected dates, or the last 6 months."
              />
              <BarChart rows={d.monthly} />
            </section>
            <div className="report-columns">
              <section className="panel">
                <SectionTitle
                  title="Where the spending goes"
                  sub="Recorded charges by service category."
                />
                {d.categories.length ? (
                  <div className="category-list">
                    {d.categories.map((c: Row, i: number) => (
                      <div key={c.name}>
                        <div>
                          <span>
                            <i
                              style={{
                                background: [
                                  "#8b478b",
                                  "#d47e93",
                                  "#c5a3d4",
                                  "#d6aa60",
                                  "#cf9267",
                                  "#a99cbd",
                                ][i % 6],
                              }}
                            />
                            {c.name}
                          </span>
                          <b>{money(c.total)}</b>
                        </div>
                        <div className="category-track">
                          <span
                            style={{
                              width: `${Number(d.totals.charges) ? (Number(c.total) / Number(d.totals.charges)) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty title="No category data" />
                )}
              </section>
              <section className="panel">
                <SectionTitle
                  title="By service centre"
                  sub="Completed work across your service network."
                />
                {d.centres.length ? (
                  <div className="centre-report">
                    {d.centres.map((c: Row) => (
                      <div key={c.id}>
                        <span className="centre-icon">
                          <Building2 size={20} />
                        </span>
                        <div>
                          <b>{c.name}</b>
                          <small>{c.completed} completed services</small>
                        </div>
                        <strong>{money(c.total)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty title="No completed services" />
                )}
              </section>
            </div>
            {p.user.role === "CUSTOMER" && (
              <section className="panel spending-panel">
                <SectionTitle
                  title="Spending by vehicle"
                  sub="Completed service charges for each car in your garage."
                />
                {d.vehicleSpending.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Vehicle</th>
                          <th>Registration</th>
                          <th>Completed services</th>
                          <th>Recorded charges</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.vehicleSpending.map((v: Row) => (
                          <tr key={v.id}>
                            <td>
                              <b>
                                {v.make} {v.model}
                              </b>
                            </td>
                            <td>{v.registration}</td>
                            <td>{v.completed}</td>
                            <td>{money(v.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="No vehicle charges recorded" />
                )}
              </section>
            )}
            {p.user.role !== "CUSTOMER" && (
              <div className="report-columns">
                <section className="panel">
                  <SectionTitle
                    title="Booking distribution"
                    sub="By arrival date and current status."
                  />
                  <div className="status-list">
                    {d.statuses.map((s: Row) => (
                      <div key={s.status}>
                        <Badge status={s.status} />
                        <b>{s.count}</b>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <SectionTitle
                    title="Inspection signals"
                    sub="Failed components, aggregated from saved inspections."
                  />
                  {!d.inspectionAnalyticsAvailable ? (
                    <ErrorPanel message="Inspection analytics are unavailable. SQL reports above are still current." />
                  ) : d.failedComponents.length ? (
                    <div className="status-list">
                      {d.failedComponents.map((f: Row) => (
                        <div key={f._id}>
                          <span className="capitalize">{f._id}</span>
                          <b>{f.count} failed checks</b>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="No failed inspection components"
                      text="Saved failed checks will appear here."
                    />
                  )}
                </section>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}
