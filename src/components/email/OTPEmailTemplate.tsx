'use client';

import React from 'react';

interface OTPEmailProps {
  otp: string;
  expiryMinutes?: number;
  university?: string;
  userName?: string;
}

export const OTPEmailTemplate = ({
  otp,
  expiryMinutes = 10,
  university = 'Campus Ride',
  userName = 'User',
}: OTPEmailProps) => {
  const timestamp = new Date().toLocaleTimeString();

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Your Campus Ride OTP</title>
        <style>{`
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            color: #333;
          }

          .container {
            width: 100%;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }

          .email-wrapper {
            max-width: 600px;
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            animation: slideUp 0.6s ease-out;
          }

          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .header {
            background: linear-gradient(135deg, #3f51b5 0%, #9575cd 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
            position: relative;
            overflow: hidden;
          }

          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
            border-radius: 50%;
            animation: float 6s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% {
              transform: translate(0, 0);
            }
            50% {
              transform: translate(10px, -10px);
            }
          }

          .header-content {
            position: relative;
            z-index: 1;
          }

          .logo {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 10px;
            letter-spacing: 0.5px;
          }

          .tagline {
            font-size: 13px;
            opacity: 0.9;
            font-weight: 500;
            letter-spacing: 0.15em;
            text-transform: uppercase;
          }

          .content {
            padding: 40px 30px;
          }

          .greeting {
            font-size: 16px;
            color: #555;
            margin-bottom: 20px;
            font-weight: 500;
          }

          .otp-section {
            background: linear-gradient(135deg, rgba(63, 81, 181, 0.08) 0%, rgba(149, 117, 205, 0.08) 100%);
            border: 2px solid rgba(63, 81, 181, 0.2);
            border-radius: 16px;
            padding: 30px;
            text-align: center;
            margin: 30px 0;
            animation: scaleIn 0.5s ease-out 0.2s both;
          }

          @keyframes scaleIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          .otp-label {
            font-size: 12px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 15px;
            font-weight: 600;
          }

          .otp-code {
            font-size: 48px;
            font-weight: 700;
            color: #3f51b5;
            letter-spacing: 8px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace;
            margin: 15px 0;
            animation: slideInDown 0.4s ease-out 0.3s both;
          }

          @keyframes slideInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .otp-note {
            font-size: 12px;
            color: #666;
            margin-top: 15px;
          }

          .expiry {
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(239, 68, 68, 0.08) 100%);
            border-left: 4px solid #f59e0b;
            border-radius: 8px;
            padding: 15px;
            margin: 25px 0;
            font-size: 13px;
            color: #744210;
            display: flex;
            gap: 12px;
            align-items: flex-start;
          }

          .expiry::before {
            content: '⏱️';
            font-size: 18px;
            flex-shrink: 0;
          }

          .security-note {
            background: #f3f4f6;
            border-radius: 12px;
            padding: 15px;
            margin: 20px 0;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }

          .security-note strong {
            color: #374151;
            font-weight: 600;
          }

          .button-section {
            text-align: center;
            margin: 30px 0;
          }

          .button {
            display: inline-block;
            background: linear-gradient(135deg, #3f51b5 0%, #2c3e8f 100%);
            color: white;
            padding: 14px 40px;
            border-radius: 12px;
            text-decoration: none;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 30px rgba(63, 81, 181, 0.3);
            animation: slideIn 0.5s ease-out 0.4s both;
          }

          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(63, 81, 181, 0.4);
          }

          .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #e5e7eb, transparent);
            margin: 30px 0;
          }

          .footer {
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            padding: 25px 30px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
          }

          .social-links {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-top: 15px;
          }

          .social-links a {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e5e7eb;
            display: flex;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            color: #6b7280;
            font-weight: 600;
            transition: all 0.3s ease;
          }

          .social-links a:hover {
            background: #3f51b5;
            color: white;
            transform: translateY(-3px);
          }

          .timestamp {
            font-size: 11px;
            color: #9ca3af;
            margin-top: 10px;
          }

          @media (max-width: 600px) {
            .header {
              padding: 30px 20px;
            }

            .content {
              padding: 25px 20px;
            }

            .otp-code {
              font-size: 36px;
              letter-spacing: 6px;
            }

            .footer {
              padding: 20px 15px;
            }

            .email-wrapper {
              border-radius: 16px;
            }
          }
        `}</style>
      </head>
      <body>
        <div className="container">
          <div className="email-wrapper">
            {/* Header */}
            <div className="header">
              <div className="header-content">
                <div className="logo">🚗 Campus Ride</div>
                <div className="tagline">Secure Verification</div>
              </div>
            </div>

            {/* Content */}
            <div className="content">
              <div className="greeting">
                Hello {userName},
              </div>

              <p style={{ fontSize: '14px', color: '#555', lineHeight: '1.6', marginBottom: '20px' }}>
                You requested to sign in to your Campus Ride account. Use the one-time passcode (OTP) below to verify your identity and complete your sign-in.
              </p>

              {/* OTP Section */}
              <div className="otp-section">
                <div className="otp-label">Your One-Time Passcode</div>
                <div className="otp-code">{otp}</div>
                <div className="otp-note">This code is valid for {expiryMinutes} minutes</div>
              </div>

              {/* Expiry Warning */}
              <div className="expiry">
                <strong>Expires in {expiryMinutes} minutes</strong><br/>
                Valid until {new Date(Date.now() + expiryMinutes * 60000).toLocaleTimeString()}
              </div>

              {/* Security Note */}
              <div className="security-note">
                <strong>🔒 Security Reminder:</strong> Never share this OTP with anyone, including Campus Ride staff. We will never ask you for this code via email, phone, or message.
              </div>

              {/* Button */}
              <div className="button-section">
                <a href="https://campusride.app" className="button">
                  Sign In to Campus Ride
                </a>
              </div>

              <p style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center', marginTop: '20px' }}>
                Didn't request this code? Your account may be at risk.{' '}
                <strong><a href="https://campusride.app/support" style={{ color: '#3f51b5', textDecoration: 'none' }}>Contact support</a></strong> immediately.
              </p>

              {/* Divider */}
              <div className="divider"></div>

              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '15px 0' }}>
                If you didn't request this OTP, you can safely ignore this email. Your account remains secure.
              </p>
            </div>

            {/* Footer */}
            <div className="footer">
              <p style={{ margin: '0 0 10px 0' }}>
                Campus Ride • Verified Student Carpooling
              </p>
              <div className="social-links">
                <a href="#" title="Facebook">f</a>
                <a href="#" title="Twitter">𝕏</a>
                <a href="#" title="Instagram">📷</a>
              </div>
              <div className="timestamp">
                Sent on {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })} at {timestamp}
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
};

export default OTPEmailTemplate;
