const nodemailer = require("nodemailer");

// ─── Transporter ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Verify connection on startup ─────────────────────────────────────────────
transporter.verify((error) => {
  if (error) console.error("❌ Mail transporter error:", error.message);
  else console.log("✅ Mail transporter ready");
});

// ─── Send Shortlist Email ─────────────────────────────────────────────────────
exports.sendShortlistEmail = async ({ to, candidate_name, job_title, company, job_id }) => {
  const mailOptions = {
    from: `"${process.env.MAIL_FROM_NAME || "AI Jobs Portal"}" <${process.env.SMTP_USER}>`,
    to,
    subject: `🎉 Congratulations! You've been shortlisted for ${job_title}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:'Segoe UI',Arial,sans-serif; }
    .wrapper { max-width:600px; margin:32px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
    .header { background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%); padding:40px 32px; text-align:center; }
    .header h1 { color:#fff; font-size:24px; margin:0 0 6px; font-weight:700; }
    .header p { color:#93c5fd; font-size:14px; margin:0; }
    .body { padding:36px 32px; }
    .greeting { font-size:18px; font-weight:700; color:#0f172a; margin-bottom:12px; }
    .message { font-size:15px; color:#475569; line-height:1.7; margin-bottom:24px; }
    .card { background:#eff6ff; border-radius:12px; padding:20px 24px; margin-bottom:28px; border-left:4px solid #2563eb; }
    .card-row { display:flex; justify-content:space-between; margin-bottom:8px; }
    .card-label { font-size:12px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:.5px; }
    .card-value { font-size:14px; color:#0f172a; font-weight:600; text-align:right; }
    .steps { margin-bottom:28px; }
    .step { display:flex; align-items:flex-start; gap:12px; margin-bottom:14px; }
    .step-num { min-width:28px; height:28px; border-radius:50%; background:#2563eb; color:#fff; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; }
    .step-text { font-size:14px; color:#475569; line-height:1.5; padding-top:4px; }
    .cta { text-align:center; margin-bottom:28px; }
    .cta a { background:#2563eb; color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:700; display:inline-block; }
    .footer { background:#f8fafc; padding:20px 32px; text-align:center; border-top:1px solid #e2e8f0; }
    .footer p { font-size:12px; color:#94a3b8; margin:4px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>🎉 You've Been Shortlisted!</h1>
      <p>AI Powered Shortlisted Jobs</p>
    </div>
    <div class="body">
      <div class="greeting">Dear ${candidate_name},</div>
      <p class="message">
        We are delighted to inform you that you have been <strong>shortlisted</strong> for the position below.
        Our AI-powered screening identified your profile as an excellent match. Our recruitment team will
        be in touch with you shortly to discuss the next steps.
      </p>

      <div class="card">
        <div class="card-row">
          <span class="card-label">Position</span>
          <span class="card-value">${job_title}</span>
        </div>
        <div class="card-row">
          <span class="card-label">Company</span>
          <span class="card-value">${company}</span>
        </div>
        <div class="card-row" style="margin-bottom:0">
          <span class="card-label">Status</span>
          <span class="card-value" style="color:#16a34a">✅ Shortlisted</span>
        </div>
      </div>

      <div class="steps">
        <p style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:14px;">What happens next?</p>
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-text"><strong>Profile Review</strong> — Our recruiter will review your full profile and resume.</div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-text"><strong>Interview Invitation</strong> — You'll receive an interview schedule via email.</div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-text"><strong>Final Decision</strong> — We'll notify you of the outcome after the interview.</div>
        </div>
      </div>

      <p class="message" style="margin-bottom:28px;">
        Please keep an eye on your inbox and ensure your phone is reachable.
        If you have any questions, feel free to reply to this email.
      </p>

      <p style="font-size:14px;color:#475569;margin-bottom:6px;text-align:center;">Best of luck! We look forward to speaking with you.</p>
    </div>
    <div class="footer">
      <p>This email was sent by <strong>AI Powered Shortlisted Jobs</strong></p>
      <p>© ${new Date().getFullYear()} All rights reserved.</p>
      <p style="margin-top:8px;font-size:11px;color:#cbd5e1;">Please do not reply if this email was received by mistake.</p>
    </div>
  </div>
</body>
</html>
    `,
  };

  await transporter.sendMail(mailOptions);
};