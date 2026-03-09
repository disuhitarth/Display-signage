function getLoginHTML(error, defaultPassword) {
  var errorText = error || "";
  var errorDisplay = error ? "block" : "none";
  return '<!DOCTYPE html>\
<html lang="en">\
<head>\
  <meta charset="UTF-8">\
  <meta name="viewport" content="width=device-width, initial-scale=1.0">\
  <title>Pizza Depot Signage — Login</title>\
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">\
  <style>\
    :root{--fire:#e84e0f;--bg:#08080a;--surface:#111114;--border:rgba(255,255,255,0.06);--text:#e8e8ec;--text-dim:#6e6e78;--text-muted:#3e3e48;--mono:"JetBrains Mono",monospace;--sans:"Outfit",sans-serif}\
    *{margin:0;padding:0;box-sizing:border-box}\
    body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden}\
    .bg-pattern{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse at 20% 50%,rgba(232,78,15,0.06) 0%,transparent 50%),radial-gradient(ellipse at 80% 20%,rgba(232,78,15,0.04) 0%,transparent 50%)}\
    .login-card{position:relative;z-index:1;width:400px;max-width:90vw;background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:48px 40px;box-shadow:0 20px 60px rgba(0,0,0,0.5)}\
    .logo-row{display:flex;align-items:center;gap:14px;margin-bottom:32px}\
    .logo-icon{width:52px;height:52px;border-radius:16px;background:linear-gradient(135deg,#e84e0f,#ff7a3d);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 24px rgba(232,78,15,0.3)}\
    .logo-text h1{font-size:22px;font-weight:800;letter-spacing:-0.5px}\
    .logo-text h1 span{color:var(--fire)}\
    .logo-text p{font-family:var(--mono);font-size:10px;color:var(--text-muted);letter-spacing:2px;text-transform:uppercase;margin-top:2px}\
    .form-group{margin-bottom:20px}\
    .form-group label{display:block;font-family:var(--mono);font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-dim);margin-bottom:8px}\
    .form-group input{width:100%;padding:14px 16px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:12px;color:var(--text);font-family:var(--sans);font-size:15px;outline:none;transition:border-color 0.2s}\
    .form-group input:focus{border-color:rgba(232,78,15,0.4);box-shadow:0 0 0 3px rgba(232,78,15,0.1)}\
    .form-group input::placeholder{color:var(--text-muted)}\
    .error-msg{background:rgba(200,40,40,0.1);border:1px solid rgba(200,40,40,0.2);border-radius:10px;padding:10px 14px;color:#e55;font-size:13px;margin-bottom:20px}\
    .submit-btn{width:100%;padding:14px;background:linear-gradient(135deg,#e84e0f,#ff6b2b);border:none;border-radius:12px;color:#fff;font-family:var(--sans);font-size:15px;font-weight:700;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(232,78,15,0.3)}\
    .submit-btn:hover{box-shadow:0 6px 28px rgba(232,78,15,0.4);transform:translateY(-1px)}\
    .submit-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}\
    .footer-note{text-align:center;margin-top:24px;font-family:var(--mono);font-size:10px;color:var(--text-muted)}\
    .default-creds{margin-top:16px;padding:10px 14px;background:rgba(232,78,15,0.06);border:1px solid rgba(232,78,15,0.15);border-radius:10px;font-family:var(--mono);font-size:11px;color:var(--text-dim);line-height:1.7}\
    .default-creds strong{color:var(--text)}\
  </style>\
</head>\
<body>\
  <div class="bg-pattern"></div>\
  <div class="login-card">\
    <div class="logo-row">\
      <div class="logo-icon">🍕</div>\
      <div class="logo-text">\
        <h1>Pizza Depot <span>Signage</span></h1>\
        <p>Franchise Admin Login</p>\
      </div>\
    </div>\
    <div class="error-msg" id="errorMsg" style="display:' + errorDisplay + '">' + errorText + '</div>\
    <form id="loginForm">\
      <div class="form-group">\
        <label>Username</label>\
        <input type="text" id="username" placeholder="Enter your username" autocomplete="username" required autofocus>\
      </div>\
      <div class="form-group">\
        <label>Password</label>\
        <input type="password" id="password" placeholder="Enter your password" autocomplete="current-password" required>\
      </div>\
      <button type="submit" class="submit-btn" id="submitBtn">Sign In</button>\
    </form>\
    <div class="footer-note">Franchise Display Management System</div>\
' + (defaultPassword ? '    <div class="default-creds">🔑 Default login — <strong>Username:</strong> admin &nbsp;|&nbsp; <strong>Password:</strong> ' + defaultPassword + '<br>Change your password after first login.</div>\
' : '') + '  </div>\
  <script>\
    document.getElementById("loginForm").addEventListener("submit",async function(e){\
      e.preventDefault();\
      var btn=document.getElementById("submitBtn"),errEl=document.getElementById("errorMsg");\
      btn.disabled=true;btn.textContent="Signing in...";errEl.style.display="none";\
      try{\
        var res=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:document.getElementById("username").value,password:document.getElementById("password").value})});\
        var data=await res.json();\
        if(data.ok){window.location.href="/admin"}else{errEl.textContent=data.error||"Invalid credentials";errEl.style.display="block"}\
      }catch(err){errEl.textContent="Connection error. Please try again.";errEl.style.display="block"}\
      btn.disabled=false;btn.textContent="Sign In";\
    });\
  </script>\
</body>\
</html>';
}
module.exports = { getLoginHTML };
