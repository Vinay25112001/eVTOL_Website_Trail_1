import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════════
   eVTOL SIZER — AUTH SYSTEM v2.0
   OTP is MANDATORY on every login — no exceptions.
   Flow:
   • Register  → fill details → send OTP → verify → logged in
   • Login     → email+pass  → send OTP → verify → logged in
   • Google    → enter email → send OTP → verify → logged in
   • Org/SSO   → org+code   → send OTP → verify → logged in
   ═══════════════════════════════════════════════════════════════ */

const C = {
  bg:"#07090f",panel:"#0d1117",border:"#1c2333",
  amber:"#f59e0b",teal:"#14b8a6",blue:"#3b82f6",
  red:"#ef4444",green:"#22c55e",dim:"#4b5563",
  text:"#e2e8f0",muted:"#64748b",purple:"#8b5cf6",
};

/* ── helpers ── */
const uid = () => Math.random().toString(36).slice(2,10);
const nowISO = () => new Date().toISOString();
const fmtTime = (iso) => {
  const d=new Date(iso), diff=(Date.now()-d)/1000;
  if(diff<60) return "just now";
  if(diff<3600) return `${Math.floor(diff/60)}m ago`;
  if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
  return d.toLocaleDateString();
};


/* ── EmailJS config ── */
const EJS_SERVICE  = "service_lr9esnm";
const EJS_TEMPLATE = "template_g6lhbyl";
const EJS_KEY      = "xdMM2-AaS1VGWJSaa";

async function sendOTPEmail(toEmail, otpCode) {
  if(!EJS_SERVICE || !EJS_TEMPLATE || !EJS_KEY) {
    throw new Error("EmailJS keys missing");
  }
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id:  EJS_SERVICE,
      template_id: EJS_TEMPLATE,
      user_id:     EJS_KEY,
      accessToken: EJS_KEY,
      template_params: { to_email: toEmail, otp_code: otpCode },
    }),
  });
  if(!res.ok) {
    const txt = await res.text().catch(()=>"");
    throw new Error(`EmailJS ${res.status}: ${txt}`);
  }
}

/* ── OTP store (in-memory, expires in 5 min) ── */
const otpStore = {};
function generateOTP(email) {
  const code = String(Math.floor(100000+Math.random()*900000));
  otpStore[email] = { code, expires: Date.now()+5*60*1000 };
  return code;
}
function verifyOTP(email, code) {
  const e = otpStore[email];
  if(!e) return false;
  if(Date.now()>e.expires) return false;
  if(!/^\d{6}$/.test(code)) return false;
  return e.code === code;
}
function clearOTP(email) { delete otpStore[email]; }

/* ── User DB (localStorage) ── */
function getUsers() { try{return JSON.parse(localStorage.getItem("evtol_users")||"{}");}catch{return{};} }
function saveUsers(u) { localStorage.setItem("evtol_users",JSON.stringify(u)); }
function getSession() { try{return JSON.parse(localStorage.getItem("evtol_session")||"null");}catch{return null;} }
function saveSession(s) { localStorage.setItem("evtol_session",JSON.stringify(s)); }
function clearSession() { localStorage.removeItem("evtol_session"); }

/* ── Notifications ── */
function getNotifs(id) { try{return JSON.parse(localStorage.getItem(`evtol_notifs_${id}`)||"[]");}catch{return[];} }
function saveNotifs(id,n) { localStorage.setItem(`evtol_notifs_${id}`,JSON.stringify(n)); }
function addNotif(id,{title,body,type="info"}) {
  const n=getNotifs(id);
  n.unshift({id:id+"_"+Date.now(),title,body,type,read:false,time:nowISO()});
  saveNotifs(id,n.slice(0,50));
}

/* ══════════════════════════════════════════════════════════════
   UI PRIMITIVES
   ══════════════════════════════════════════════════════════════ */
function Input({label,type="text",value,onChange,placeholder,autoFocus,error}){
  const[show,setShow]=useState(false);
  const isP=type==="password";
  return(
    <div style={{marginBottom:14}}>
      {label&&<div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:5,letterSpacing:"0.08em",textTransform:"uppercase"}}>{label}</div>}
      <div style={{position:"relative"}}>
        <input
          type={isP&&show?"text":type} value={value}
          onChange={e=>onChange(e.target.value)}
          placeholder={placeholder} autoFocus={autoFocus}
          style={{width:"100%",boxSizing:"border-box",background:"#0a0d14",
            border:`1px solid ${error?C.red:C.border}`,borderRadius:6,color:C.text,
            fontSize:13,padding:"10px 40px 10px 12px",fontFamily:"'DM Mono',monospace",outline:"none"}}
          onFocus={e=>e.target.style.borderColor=C.amber}
          onBlur={e=>e.target.style.borderColor=error?C.red:C.border}
        />
        {isP&&(
          <button onClick={()=>setShow(s=>!s)} type="button" style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:13,padding:2}}>
            {show?"🙈":"👁"}
          </button>
        )}
      </div>
      {error&&<div style={{fontSize:10,color:C.red,marginTop:4,fontFamily:"'DM Mono',monospace"}}>{error}</div>}
    </div>
  );
}

function Btn({children,onClick,variant="primary",loading,fullWidth,small}){
  const s={
    primary:{background:`linear-gradient(135deg,${C.amber},#f97316)`,color:"#07090f",border:"none"},
    secondary:{background:"transparent",color:C.text,border:`1px solid ${C.border}`},
    google:{background:"#fff",color:"#1f2937",border:"1px solid #d1d5db"},
    blue:{background:`linear-gradient(135deg,#1e3a5f,#1e40af)`,color:"#93c5fd",border:`1px solid ${C.blue}`},
    ghost:{background:"transparent",color:C.muted,border:"none"},
  };
  return(
    <button onClick={onClick} disabled={loading} type="button"
      style={{...s[variant],padding:small?"6px 14px":"10px 20px",borderRadius:6,
        fontSize:small?11:13,fontWeight:700,fontFamily:"'DM Mono',monospace",
        cursor:loading?"not-allowed":"pointer",width:fullWidth?"100%":"auto",
        letterSpacing:"0.04em",opacity:loading?0.6:1,
        display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"transform 0.1s"}}
      onMouseEnter={e=>{if(!loading)e.currentTarget.style.transform="translateY(-1px)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";}}
    >
      {loading?<span style={{animation:"spin 0.7s linear infinite",display:"inline-block"}}>⏳</span>:children}
    </button>
  );
}

function Divider({text}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,margin:"16px 0"}}>
      <div style={{flex:1,height:1,background:C.border}}/>
      <span style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{text}</span>
      <div style={{flex:1,height:1,background:C.border}}/>
    </div>
  );
}

function Alert({type,children}){
  const cols={error:C.red,success:C.green,info:C.blue,warn:C.amber};
  const icons={error:"✗",success:"✓",info:"ℹ",warn:"⚠"};
  const col=cols[type]||C.muted;
  return(
    <div style={{background:`${col}11`,border:`1px solid ${col}44`,borderRadius:6,
      padding:"9px 12px",marginBottom:12,display:"flex",gap:8,alignItems:"flex-start"}}>
      <span style={{color:col,fontSize:12,flexShrink:0,marginTop:1}}>{icons[type]}</span>
      <span style={{fontSize:11,color:col,fontFamily:"'DM Mono',monospace",lineHeight:1.5}}>{children}</span>
    </div>
  );
}

/* ── 6-box OTP input ── */
function OTPInput({value,onChange}){
  const refs=useRef([]);
  const digits=(value||"").replace(/\D/g,"").split("").slice(0,6);
  while(digits.length<6) digits.push("");

  const handleChange=(i,v)=>{
    const d=v.replace(/\D/g,"").slice(-1);
    const arr=[...digits]; arr[i]=d;
    onChange(arr.join(""));
    if(d&&i<5) refs.current[i+1]?.focus();
  };
  const handleKey=(i,e)=>{
    if(e.key==="Backspace"&&!digits[i]&&i>0){
      const arr=[...digits]; arr[i-1]="";
      onChange(arr.join(""));
      refs.current[i-1]?.focus();
    }
    if(e.key==="ArrowLeft"&&i>0) refs.current[i-1]?.focus();
    if(e.key==="ArrowRight"&&i<5) refs.current[i+1]?.focus();
  };
  const handlePaste=(e)=>{
    const p=e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if(p){ onChange(p); refs.current[Math.min(p.length,5)]?.focus(); }
    e.preventDefault();
  };

  return(
    <div style={{display:"flex",gap:8,justifyContent:"center",margin:"20px 0"}}>
      {[0,1,2,3,4,5].map(i=>(
        <input key={i} ref={el=>refs.current[i]=el}
          type="text" inputMode="numeric" maxLength={1}
          value={digits[i]}
          onChange={e=>handleChange(i,e.target.value)}
          onKeyDown={e=>handleKey(i,e)}
          onPaste={handlePaste}
          style={{width:46,height:54,textAlign:"center",fontSize:24,fontWeight:700,
            fontFamily:"'DM Mono',monospace",background:"#0a0d14",
            border:`2px solid ${digits[i]?C.amber:C.border}`,
            borderRadius:8,color:C.amber,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=C.amber}
          onBlur={e=>e.target.style.borderColor=digits[i]?C.amber:C.border}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   OTP VERIFICATION SCREEN
   Shown after any successful credential check — always required
   ══════════════════════════════════════════════════════════════ */
function OTPScreen({email, onVerified, onBack}){
  const[otp,setOtp]=useState("");
  const[loading,setLoading]=useState(false);
  const[sending,setSending]=useState(true); // starts by auto-sending
  const[err,setErr]=useState("");
  const[info,setInfo]=useState("");
  const[timer,setTimer]=useState(0);
  const timerRef=useRef(null);

  const startTimer=()=>{
    setTimer(60);
    clearInterval(timerRef.current);
    timerRef.current=setInterval(()=>{
      setTimer(t=>{ if(t<=1){clearInterval(timerRef.current);return 0;} return t-1; });
    },1000);
  };

  // Auto-send OTP as soon as this screen appears
  useEffect(()=>{
    sendCode();
    return ()=>clearInterval(timerRef.current);
  },[]);

  const sendCode=async()=>{
    setErr(""); setInfo(""); setSending(true);
    try{
      const code=generateOTP(email);
      await sendOTPEmail(email,code);
      startTimer();
      setInfo(`Code sent to ${email}`);
    }catch(e){
      setErr("Failed to send OTP: "+e.message);
    }
    setSending(false);
  };

  const handleVerify=async()=>{
    setErr("");
    const clean=otp.replace(/\D/g,"");
    if(clean.length!==6) return setErr("Enter all 6 digits.");
    setLoading(true);
    await new Promise(r=>setTimeout(r,500));
    if(!verifyOTP(email,clean)){
      setLoading(false);
      setOtp("");
      return setErr("Wrong or expired code. Request a new one.");
    }
    clearOTP(email);
    setLoading(false);
    onVerified();
  };

  return(
    <div>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:32,marginBottom:8}}>📧</div>
        <div style={{fontSize:15,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>Check your email</div>
        <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:6,lineHeight:1.6}}>
          We sent a 6-digit code to<br/>
          <span style={{color:C.amber,fontWeight:700}}>{email}</span>
        </div>
      </div>

      {err&&<Alert type="error">{err}</Alert>}
      {info&&!err&&<Alert type="success">{info}</Alert>}

      {sending?(
        <div style={{textAlign:"center",padding:"20px 0",color:C.muted,fontSize:12,fontFamily:"'DM Mono',monospace"}}>
          <span style={{animation:"spin 0.7s linear infinite",display:"inline-block"}}>⏳</span> Sending code...
        </div>
      ):(
        <>
          <OTPInput value={otp} onChange={setOtp}/>
          <Btn variant="primary" fullWidth onClick={handleVerify} loading={loading}>
            Verify & Sign In →
          </Btn>
          <div style={{textAlign:"center",marginTop:12,fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>
            {timer>0?(
              <span>Resend code in {timer}s</span>
            ):(
              <button onClick={sendCode} type="button" style={{background:"none",border:"none",color:C.amber,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:700,padding:0}}>
                Resend code
              </button>
            )}
          </div>
        </>
      )}

      <div style={{textAlign:"center",marginTop:16}}>
        <button onClick={onBack} type="button" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Mono',monospace",padding:0}}>
          ← Back
        </button>
      </div>
      <div style={{fontSize:9,color:C.dim,fontFamily:"'DM Mono',monospace",textAlign:"center",marginTop:10,lineHeight:1.6}}>
        Check your spam/junk folder if you don't see it.<br/>Code expires in 5 minutes.
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH MODAL — main component
   Steps: credentials → OTP verify → logged in
   ══════════════════════════════════════════════════════════════ */
function AuthModal({onClose, onAuth, defaultFlow="login"}){
  // stage: "creds" | "otp"
  const[stage,setStage]=useState("creds");
  const[flow,setFlow]=useState(defaultFlow);

  // credential fields
  const[email,setEmail]=useState("");
  const[password,setPassword]=useState("");
  const[confirmPw,setConfirmPw]=useState("");
  const[name,setName]=useState("");
  const[org,setOrg]=useState("");
  const[orgCode,setOrgCode]=useState("");
  const[googleEmail,setGoogleEmail]=useState("");
  const[showGoogleInput,setShowGoogleInput]=useState(false);

  const[loading,setLoading]=useState(false);
  const[err,setErr]=useState("");

  // pending user object — set after credential check, before OTP verify
  const pendingUser=useRef(null);

  const reset=()=>{setErr("");};

  // Called after OTP verified — complete the login
  const handleOTPVerified=()=>{
    const u=pendingUser.current;
    if(!u) return;
    const session={id:u.id,name:u.name,email:u.email,org:u.org,avatar:u.avatar,token:uid()};
    saveSession(session);
    addNotif(u.id,{title:"Login Successful",body:`Welcome${u.name?", "+u.name:""}! OTP verified.`,type:"success"});
    onAuth(session);
  };

  // Helper — resolve/create user and move to OTP stage
  const proceedToOTP=(user)=>{
    pendingUser.current=user;
    setStage("otp");
  };

  /* ── REGISTER ── */
  const handleRegister=async()=>{
    reset();
    if(!name.trim()) return setErr("Full name is required.");
    if(!email.includes("@")) return setErr("Enter a valid email.");
    if(password.length<8) return setErr("Password must be ≥ 8 characters.");
    if(password!==confirmPw) return setErr("Passwords do not match.");
    setLoading(true);
    await new Promise(r=>setTimeout(r,500));
    const users=getUsers();
    if(users[email]){setLoading(false);return setErr("Account already exists. Please log in.");}
    const u={id:uid(),name,email,org:org||null,createdAt:nowISO(),avatar:name[0].toUpperCase(),pwHash:btoa(password)};
    users[email]=u;
    saveUsers(users);
    setLoading(false);
    proceedToOTP(u);
  };

  /* ── LOGIN ── */
  const handleLogin=async()=>{
    reset();
    if(!email.includes("@")) return setErr("Enter a valid email.");
    if(!password) return setErr("Password is required.");
    setLoading(true);
    await new Promise(r=>setTimeout(r,500));
    const users=getUsers();
    const u=users[email];
    if(!u||u.pwHash!==btoa(password)){setLoading(false);return setErr("Invalid email or password.");}
    setLoading(false);
    proceedToOTP(u);
  };

  /* ── GOOGLE ── */
  const handleGoogle=async()=>{
    reset();
    if(!googleEmail.trim()) return setErr("Enter your Gmail address.");
    if(!googleEmail.includes("@")) return setErr("Enter a valid email.");
    setLoading(true);
    await new Promise(r=>setTimeout(r,500));
    const gEmail=googleEmail.trim().toLowerCase();
    const users=getUsers();
    let u=users[gEmail];
    if(!u){
      const gName=gEmail.split("@")[0].replace(/[._]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
      u={id:uid(),name:gName,email:gEmail,org:null,createdAt:nowISO(),avatar:gName[0].toUpperCase(),pwHash:"",provider:"google"};
      users[gEmail]=u;
      saveUsers(users);
    }
    setLoading(false);
    proceedToOTP(u);
  };

  /* ── ORG SSO ── */
  const handleOrg=async()=>{
    reset();
    if(!org.trim()) return setErr("Enter your organization name.");
    if(!orgCode.trim()) return setErr("Enter your SSO access code.");
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    if(orgCode.toUpperCase()!=="WSU2025"){setLoading(false);return setErr("Invalid SSO code. (Demo: use WSU2025)");}
    const orgName=org.trim();
    const mockEmail=`user@${orgName.toLowerCase().replace(/\s+/g,"")}.edu`;
    const users=getUsers();
    let u=users[mockEmail];
    if(!u){
      u={id:uid(),name:`${orgName} User`,email:mockEmail,org:orgName,createdAt:nowISO(),avatar:orgName[0].toUpperCase(),pwHash:""};
      users[mockEmail]=u;
      saveUsers(users);
    }
    setLoading(false);
    proceedToOTP(u);
  };

  /* ── FORGOT PASSWORD ── */
  const handleForgot=async()=>{
    reset();
    if(!email.includes("@")) return setErr("Enter your registered email.");
    setLoading(true);
    await new Promise(r=>setTimeout(r,700));
    setLoading(false);
    setErr(""); 
    // Show info via alert
    pendingUser.current=null;
    alert("If an account exists for "+email+", a reset link has been sent. (Demo only)");
  };

  const GoogleSVG=()=>(
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  const titles={login:"Sign In",register:"Create Account",otp:"OTP Login",org:"Organization Login",forgot:"Reset Password"};

  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(7,9,15,0.88)",
      backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:12,
        padding:"28px 32px",width:420,maxWidth:"92vw",maxHeight:"90vh",overflowY:"auto",
        boxShadow:`0 0 60px ${C.amber}18`,animation:"slideUp 0.25s ease"}}>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <div>
            <div style={{fontSize:8,color:C.muted,letterSpacing:"0.2em",fontFamily:"'DM Mono',monospace",marginBottom:4}}>AEROSPACE DESIGN SUITE</div>
            <div style={{fontSize:20,fontWeight:800,letterSpacing:"-0.03em"}}>
              <span style={{color:C.amber}}>eVTOL</span>
              <span style={{color:C.text}}> — {stage==="otp"?"Verify OTP":titles[flow]}</span>
            </div>
          </div>
          <button onClick={onClose} type="button" style={{background:"none",border:"none",color:C.muted,fontSize:20,cursor:"pointer",padding:4,lineHeight:1}}>✕</button>
        </div>

        {/* OTP STAGE — shown after any successful credential check */}
        {stage==="otp"&&(
          <OTPScreen
            email={pendingUser.current?.email||""}
            onVerified={handleOTPVerified}
            onBack={()=>{setStage("creds");setErr("");}}
          />
        )}

        {/* CREDENTIALS STAGE */}
        {stage==="creds"&&(
          <>
            {err&&<Alert type="error">{err}</Alert>}

            {/* ── LOGIN ── */}
            {flow==="login"&&(
              <>
                {/* Google button */}
                {showGoogleInput?(
                  <div style={{background:"#0a0d14",border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <GoogleSVG/>
                      <span style={{fontSize:11,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>Continue with Google</span>
                      <button onClick={()=>{setShowGoogleInput(false);reset();}} type="button" style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:0}}>✕</button>
                    </div>
                    <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:8}}>Enter your Gmail — OTP will be sent to verify.</div>
                    <Input value={googleEmail} onChange={setGoogleEmail} placeholder="yourname@gmail.com" autoFocus type="email"/>
                    <Btn variant="google" fullWidth onClick={handleGoogle} loading={loading}>Send OTP to Gmail →</Btn>
                  </div>
                ):(
                  <Btn variant="google" fullWidth onClick={()=>{reset();setShowGoogleInput(true);}}>
                    <GoogleSVG/> Continue with Google
                  </Btn>
                )}
                <Divider text="or sign in with email"/>
                <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com"/>
                <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••"/>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:-8,marginBottom:14}}>
                  <button onClick={()=>{reset();setFlow("forgot");}} type="button" style={{background:"none",border:"none",color:C.muted,fontSize:10,cursor:"pointer",fontFamily:"'DM Mono',monospace",padding:0}}>Forgot password?</button>
                </div>
                <Btn variant="primary" fullWidth onClick={handleLogin} loading={loading}>Send OTP & Sign In →</Btn>
                <Divider text="other options"/>
                <div style={{display:"flex",gap:8}}>
                  <Btn variant="secondary" fullWidth onClick={()=>{reset();setFlow("otp_only");}}>📱 OTP Only</Btn>
                  <Btn variant="secondary" fullWidth onClick={()=>{reset();setFlow("org");}}>🏢 Org / SSO</Btn>
                </div>
                <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>
                  No account?{" "}
                  <button onClick={()=>{reset();setFlow("register");}} type="button" style={{background:"none",border:"none",color:C.amber,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:700,padding:0}}>Create one →</button>
                </div>
              </>
            )}

            {/* ── REGISTER ── */}
            {flow==="register"&&(
              <>
                {showGoogleInput?(
                  <div style={{background:"#0a0d14",border:`1px solid ${C.border}`,borderRadius:8,padding:"14px 16px",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <GoogleSVG/>
                      <span style={{fontSize:11,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>Sign up with Google</span>
                      <button onClick={()=>{setShowGoogleInput(false);reset();}} type="button" style={{marginLeft:"auto",background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:0}}>✕</button>
                    </div>
                    <Input value={googleEmail} onChange={setGoogleEmail} placeholder="yourname@gmail.com" autoFocus type="email"/>
                    <Btn variant="google" fullWidth onClick={handleGoogle} loading={loading}>Send OTP to Gmail →</Btn>
                  </div>
                ):(
                  <Btn variant="google" fullWidth onClick={()=>{reset();setShowGoogleInput(true);}}>
                    <GoogleSVG/> Sign up with Google
                  </Btn>
                )}
                <Divider text="or create with email"/>
                <Input label="Full Name" value={name} onChange={setName} placeholder="Dr. Jane Smith" autoFocus/>
                <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com"/>
                <Input label="Organization (optional)" value={org} onChange={setOrg} placeholder="Wright State University"/>
                <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 8 characters"/>
                <Input label="Confirm Password" type="password" value={confirmPw} onChange={setConfirmPw} placeholder="Repeat password"/>
                <div style={{fontSize:9,color:C.dim,fontFamily:"'DM Mono',monospace",marginBottom:14,lineHeight:1.6}}>
                  By creating an account you agree to our Terms and Privacy Policy.
                </div>
                <Btn variant="primary" fullWidth onClick={handleRegister} loading={loading}>Create Account & Verify OTP →</Btn>
                <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace"}}>
                  Already have one?{" "}
                  <button onClick={()=>{reset();setFlow("login");}} type="button" style={{background:"none",border:"none",color:C.amber,cursor:"pointer",fontSize:11,fontFamily:"'DM Mono',monospace",fontWeight:700,padding:0}}>Sign in →</button>
                </div>
              </>
            )}

            {/* ── OTP ONLY (email only, no password) ── */}
            {flow==="otp_only"&&(
              <>
                <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:16,lineHeight:1.7}}>
                  Enter your email — we'll send a one-time code. No password needed.
                </div>
                <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus/>
                <Btn variant="primary" fullWidth onClick={async()=>{
                  reset();
                  if(!email.includes("@")) return setErr("Enter a valid email.");
                  setLoading(true);
                  await new Promise(r=>setTimeout(r,400));
                  const users=getUsers();
                  let u=users[email];
                  if(!u){
                    u={id:uid(),name:email.split("@")[0],email,org:null,createdAt:nowISO(),avatar:email[0].toUpperCase(),pwHash:""};
                    users[email]=u; saveUsers(users);
                  }
                  setLoading(false);
                  proceedToOTP(u);
                }} loading={loading}>Send OTP →</Btn>
                <div style={{textAlign:"center",marginTop:16}}>
                  <button onClick={()=>{reset();setFlow("login");}} type="button" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Mono',monospace"}}>← Back to login</button>
                </div>
              </>
            )}

            {/* ── ORG / SSO ── */}
            {flow==="org"&&(
              <>
                <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:16,lineHeight:1.7}}>
                  Sign in via your institution SSO. OTP will still be required to verify.
                </div>
                <Input label="Organization / Domain" value={org} onChange={setOrg} placeholder="Wright State University" autoFocus/>
                <Input label="SSO Access Code" value={orgCode} onChange={setOrgCode} placeholder="e.g. WSU2025"/>
                <div style={{fontSize:9,color:C.dim,fontFamily:"'DM Mono',monospace",marginBottom:14}}>Demo SSO code: <span style={{color:C.amber}}>WSU2025</span></div>
                <Btn variant="blue" fullWidth onClick={handleOrg} loading={loading}>🏢 Authenticate & Send OTP →</Btn>
                <Divider text="supported providers"/>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:8}}>
                  {["Okta","Azure AD","Google Workspace","Shibboleth","SAML 2.0"].map(p=>(
                    <span key={p} style={{fontSize:9,color:C.muted,background:"#111827",border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 8px",fontFamily:"'DM Mono',monospace"}}>{p}</span>
                  ))}
                </div>
                <div style={{textAlign:"center",marginTop:16}}>
                  <button onClick={()=>{reset();setFlow("login");}} type="button" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Mono',monospace"}}>← Back to login</button>
                </div>
              </>
            )}

            {/* ── FORGOT ── */}
            {flow==="forgot"&&(
              <>
                <div style={{fontSize:11,color:C.muted,fontFamily:"'DM Mono',monospace",marginBottom:16,lineHeight:1.7}}>
                  Enter your registered email to receive a password reset link.
                </div>
                <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus/>
                <Btn variant="primary" fullWidth onClick={handleForgot} loading={loading}>Send Reset Link →</Btn>
                <div style={{textAlign:"center",marginTop:16}}>
                  <button onClick={()=>{reset();setFlow("login");}} type="button" style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:10,fontFamily:"'DM Mono',monospace"}}>← Back to login</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   NOTIFICATION CENTER
   ══════════════════════════════════════════════════════════════ */
function NotifCenter({user,onClose}){
  const[notifs,setNotifs]=useState(()=>getNotifs(user.id));
  const markAll=()=>{ const u=notifs.map(n=>({...n,read:true})); setNotifs(u); saveNotifs(user.id,u); };
  const markOne=(id)=>{ const u=notifs.map(n=>n.id===id?{...n,read:true}:n); setNotifs(u); saveNotifs(user.id,u); };
  const del=(id)=>{ const u=notifs.filter(n=>n.id!==id); setNotifs(u); saveNotifs(user.id,u); };
  const icons={info:"ℹ️",success:"✅",warn:"⚠️",error:"❌"};
  const unread=notifs.filter(n=>!n.read).length;
  return(
    <div style={{position:"absolute",top:"100%",right:0,zIndex:200,marginTop:8,
      background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,
      width:340,maxHeight:440,display:"flex",flexDirection:"column",
      boxShadow:"0 8px 40px rgba(0,0,0,0.6)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>Notifications</span>
          {unread>0&&<span style={{background:C.red,color:"#fff",fontSize:9,borderRadius:10,padding:"2px 6px",fontWeight:700}}>{unread}</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {unread>0&&<button onClick={markAll} type="button" style={{background:"none",border:"none",color:C.muted,fontSize:9,cursor:"pointer",fontFamily:"'DM Mono',monospace"}}>Mark all read</button>}
          <button onClick={onClose} type="button" style={{background:"none",border:"none",color:C.muted,fontSize:16,cursor:"pointer",lineHeight:1,padding:0}}>✕</button>
        </div>
      </div>
      <div style={{overflowY:"auto",flex:1}}>
        {notifs.length===0?(
          <div style={{padding:28,textAlign:"center",color:C.dim,fontSize:11,fontFamily:"'DM Mono',monospace"}}>🛩️ No notifications yet</div>
        ):notifs.map(n=>(
          <div key={n.id} onClick={()=>markOne(n.id)} style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}22`,
            background:n.read?"transparent":`${C.amber}08`,display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer"}}>
            <span style={{fontSize:14,flexShrink:0,marginTop:1}}>{icons[n.type]||"🔔"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
                <span style={{fontSize:11,fontWeight:n.read?400:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>{n.title}</span>
                {!n.read&&<div style={{width:6,height:6,borderRadius:"50%",background:C.amber,flexShrink:0}}/>}
              </div>
              <div style={{fontSize:10,color:C.muted,fontFamily:"'DM Mono',monospace",marginTop:2,lineHeight:1.5}}>{n.body}</div>
              <div style={{fontSize:9,color:C.dim,fontFamily:"'DM Mono',monospace",marginTop:3}}>{fmtTime(n.time)}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();del(n.id);}} type="button" style={{background:"none",border:"none",color:C.dim,fontSize:12,cursor:"pointer",padding:"0 2px",flexShrink:0}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE DROPDOWN
   ══════════════════════════════════════════════════════════════ */
function ProfileDropdown({user,onSignOut,onClose}){
  const items=[
    {icon:"👤",label:"Profile & Settings",action:()=>{alert("Profile settings — coming soon!");onClose();}},
    {icon:"📐",label:"My Designs",action:()=>{alert("Saved designs — coming soon!");onClose();}},
    {icon:"🔑",label:"Change Password",action:()=>{alert("Password change — coming soon!");onClose();}},
    {icon:"🏢",label:"Organization",action:()=>{alert(`Org: ${user.org||"Not set"}`);onClose();}},
    {icon:"📄",label:"Report History",action:()=>{alert("Report history — coming soon!");onClose();}},
  ];
  return(
    <div style={{position:"absolute",top:"100%",right:0,zIndex:200,marginTop:8,
      background:C.panel,border:`1px solid ${C.border}`,borderRadius:10,
      width:240,boxShadow:"0 8px 40px rgba(0,0,0,0.6)"}}>
      <div style={{padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:"50%",background:`linear-gradient(135deg,${C.amber},#f97316)`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#07090f",flexShrink:0}}>
            {user.avatar}
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace"}}>{user.name}</div>
            <div style={{fontSize:9,color:C.muted,fontFamily:"'DM Mono',monospace"}}>{user.email}</div>
            {user.org&&<div style={{fontSize:9,color:C.purple,fontFamily:"'DM Mono',monospace",marginTop:1}}>🏢 {user.org}</div>}
          </div>
        </div>
      </div>
      {items.map(item=>(
        <button key={item.label} onClick={item.action} type="button" style={{width:"100%",padding:"9px 16px",background:"none",border:"none",
          display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left",borderBottom:`1px solid ${C.border}22`}}
          onMouseEnter={e=>e.currentTarget.style.background="#ffffff08"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
          <span style={{fontSize:13}}>{item.icon}</span>
          <span style={{fontSize:11,color:C.text,fontFamily:"'DM Mono',monospace"}}>{item.label}</span>
        </button>
      ))}
      <button onClick={onSignOut} type="button" style={{width:"100%",padding:"10px 16px",background:"none",border:"none",
        display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left"}}
        onMouseEnter={e=>e.currentTarget.style.background=`${C.red}11`}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <span style={{fontSize:13}}>🚪</span>
        <span style={{fontSize:11,color:C.red,fontFamily:"'DM Mono',monospace",fontWeight:700}}>Sign Out</span>
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH GATE
   ══════════════════════════════════════════════════════════════ */
function AuthGate({user,onAuth,children}){
  const[showModal,setShowModal]=useState(false);
  const pendingCb=useRef(null);

  const handleCapture=(e)=>{
    e.stopPropagation(); e.preventDefault();
    pendingCb.current=children.props.onClick||null;
    setShowModal(true);
  };

  const handleAuthSuccess=(session)=>{
    setShowModal(false);
    onAuth(session);
    const cb=pendingCb.current;
    if(cb) setTimeout(()=>cb(),200);
  };

  return(
    <>
      <div style={{position:"relative",display:"inline-flex"}}>
        {children}
        {!user&&(
          <div onClick={handleCapture} title="Sign in required"
            style={{position:"absolute",inset:0,zIndex:10,cursor:"pointer",borderRadius:"inherit",background:"transparent"}}/>
        )}
      </div>
      {showModal&&<AuthModal onClose={()=>setShowModal(false)} onAuth={handleAuthSuccess} defaultFlow="login"/>}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   USER HEADER BAR
   ══════════════════════════════════════════════════════════════ */
function UserHeaderBar({user,onSignOut,onSignIn}){
  const[showNotifs,setShowNotifs]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[notifCount,setNotifCount]=useState(0);
  const notifRef=useRef(null);
  const profileRef=useRef(null);

  useEffect(()=>{
    if(user){ setNotifCount(getNotifs(user.id).filter(x=>!x.read).length); }
  },[user,showNotifs]);

  useEffect(()=>{
    const h=(e)=>{
      if(notifRef.current&&!notifRef.current.contains(e.target)) setShowNotifs(false);
      if(profileRef.current&&!profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);

  if(!user) return(
    <div style={{display:"flex",gap:8,marginLeft:"auto",alignItems:"center"}}>
      <button onClick={onSignIn} type="button" style={{padding:"6px 14px",background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Sign In</button>
      <button onClick={onSignIn} type="button" style={{padding:"6px 14px",background:`linear-gradient(135deg,${C.amber},#f97316)`,border:"none",borderRadius:6,color:"#07090f",fontSize:11,cursor:"pointer",fontFamily:"'DM Mono',monospace",fontWeight:700}}>Register →</button>
    </div>
  );

  return(
    <div style={{display:"flex",gap:10,marginLeft:"auto",alignItems:"center"}}>
      <div ref={notifRef} style={{position:"relative"}}>
        <button onClick={()=>{setShowNotifs(s=>!s);setShowProfile(false);}} type="button"
          style={{background:showNotifs?`${C.amber}15`:"transparent",border:`1px solid ${showNotifs?C.amber+"44":C.border}`,
            borderRadius:6,padding:"5px 9px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,position:"relative"}}>
          <span style={{fontSize:14}}>🔔</span>
          {notifCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:C.red,color:"#fff",fontSize:8,borderRadius:10,padding:"1px 5px",fontWeight:800,fontFamily:"'DM Mono',monospace",minWidth:16,textAlign:"center"}}>{notifCount>9?"9+":notifCount}</span>}
        </button>
        {showNotifs&&<NotifCenter user={user} onClose={()=>setShowNotifs(false)}/>}
      </div>
      <div ref={profileRef} style={{position:"relative"}}>
        <button onClick={()=>{setShowProfile(s=>!s);setShowNotifs(false);}} type="button"
          style={{display:"flex",alignItems:"center",gap:8,background:showProfile?`${C.amber}15`:"transparent",
            border:`1px solid ${showProfile?C.amber+"44":C.border}`,borderRadius:6,padding:"4px 10px 4px 5px",cursor:"pointer"}}>
          <div style={{width:26,height:26,borderRadius:"50%",background:`linear-gradient(135deg,${C.amber},#f97316)`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#07090f"}}>
            {user.avatar}
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontSize:10,fontWeight:700,color:C.text,fontFamily:"'DM Mono',monospace",lineHeight:1.2}}>{user.name.split(" ")[0]}</div>
            {user.org&&<div style={{fontSize:8,color:C.purple,fontFamily:"'DM Mono',monospace"}}>🏢 {user.org}</div>}
          </div>
          <span style={{fontSize:8,color:C.dim}}>{showProfile?"▾":"▸"}</span>
        </button>
        {showProfile&&<ProfileDropdown user={user} onSignOut={onSignOut} onClose={()=>setShowProfile(false)}/>}
      </div>
    </div>
  );
}

/* ── EXPORTS ── */
export { AuthModal, AuthGate, UserHeaderBar, NotifCenter, getSession, saveSession, clearSession, addNotif };
