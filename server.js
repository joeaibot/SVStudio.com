const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const {google} = require('googleapis');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './service-account.json';
const BUFFER_HOURS = parseInt(process.env.BUFFER_HOURS || '1', 10);
const MIN_HOURS = parseInt(process.env.MIN_HOURS || '2', 10);
const MAX_HOURS = parseInt(process.env.MAX_HOURS || '8', 10);

// Pricing configuration
const HOURLY_RATE = parseFloat(process.env.HOURLY_RATE || '75', 10); // $75 per hour
const BOOKING_FEE = parseFloat(process.env.BOOKING_FEE || '25', 10); // $25 booking fee

// Email configuration
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = process.env.EMAIL_PORT || 587;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@svstudio.com';

// SMS configuration (Twilio)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

if (!SHEET_ID || !CALENDAR_ID) {
  console.warn('Please set GOOGLE_SHEET_ID and GOOGLE_CALENDAR_ID in .env');
}

// Load service account key
let jwtClient;
try {
  const keyFile = fs.readFileSync(KEY_PATH, 'utf8');
  const key = JSON.parse(keyFile);
  jwtClient = new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/spreadsheets']
  );
} catch (err) {
  console.error('Error loading service account key:', err.message);
}

const sheets = google.sheets({version: 'v4', auth: jwtClient});
const calendar = google.calendar({version: 'v3', auth: jwtClient});

// Team member contact information for notifications
const teamMembers = {
  'Rey': {
    email: 'rey@svstudio.com',
    phone: '+1555123456',
    name: 'Rey'
  },
  'Joe': {
    email: 'joe@svstudio.com',
    phone: '+1555123457',
    name: 'Joe'
  },
  'Jane Smith': {
    email: 'jane@svstudio.com',
    phone: '+1555123458',
    name: 'Jane Smith'
  },
  'Maria Garcia': {
    email: 'maria@svstudio.com',
    phone: '+1555123459',
    name: 'Maria Garcia'
  },
  'Carlos Rodriguez': {
    email: 'carlos@svstudio.com',
    phone: '+1555123460',
    name: 'Carlos Rodriguez'
  },
  'Sarah Johnson': {
    email: 'sarah@svstudio.com',
    phone: '+1555123461',
    name: 'Sarah Johnson'
  }
};

// Email transporter setup
let emailTransporter = null;
if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
  emailTransporter = nodemailer.createTransporter({
    host: EMAIL_HOST,
    port: EMAIL_PORT,
    secure: EMAIL_PORT === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

// SMS client setup
let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

// Notification functions
async function sendEmail(to, subject, html) {
  if (!emailTransporter) {
    console.log('Email not configured, skipping email notification');
    return;
  }

  try {
    await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to: to,
      subject: subject,
      html: html
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

async function sendSMS(to, message) {
  if (!twilioClient) {
    console.log('SMS not configured, skipping SMS notification');
    return;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: to
    });
    console.log(`SMS sent to ${to}`);
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}

async function sendBookingNotifications(booking) {
  const { member, date, start, duration, customer, email, phone, studio } = booking;
  const teamMember = teamMembers[member];

  if (!teamMember) {
    console.log(`No contact info found for team member: ${member}`);
    return;
  }

  // Format date and time
  const startDate = new Date(`${date}T${String(start).padStart(2,'0')}:00:00`);
  const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

  const formatDate = (date) => date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatTime = (date) => date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Client notification
  const clientSubject = `Booking Confirmed - SVStudio`;
  const clientHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">Booking Confirmed!</h2>
      <p>Dear ${customer},</p>
      <p>Your booking with SVStudio has been confirmed. Here are the details:</p>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">Booking Details</h3>
        <p><strong>Team Member:</strong> ${member}</p>
        <p><strong>Date:</strong> ${formatDate(startDate)}</p>
        <p><strong>Time:</strong> ${formatTime(startDate)} - ${formatTime(endDate)}</p>
        <p><strong>Duration:</strong> ${duration} hour${duration > 1 ? 's' : ''}</p>
        <p><strong>Studio:</strong> ${studio || 'TBD'}</p>
      </div>

      <p>If you need to make any changes or have questions, please contact us at ${EMAIL_FROM}.</p>
      <p>Thank you for choosing SVStudio!</p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
        <p>SVStudio<br>
        Your hub for creative practices, stunning photography, engaging podcasts, and memorable events.</p>
      </div>
    </div>
  `;

  const clientSMS = `SVStudio: Booking confirmed! ${member} on ${formatDate(startDate)} at ${formatTime(startDate)}. Duration: ${duration}hr. Studio: ${studio || 'TBD'}`;

  // Team member notification
  const memberSubject = `New Booking - ${customer}`;
  const memberHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">New Booking Assigned</h2>
      <p>Hi ${teamMember.name},</p>
      <p>You have a new booking scheduled. Here are the details:</p>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">Booking Details</h3>
        <p><strong>Client:</strong> ${customer}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Date:</strong> ${formatDate(startDate)}</p>
        <p><strong>Time:</strong> ${formatTime(startDate)} - ${formatTime(endDate)}</p>
        <p><strong>Duration:</strong> ${duration} hour${duration > 1 ? 's' : ''}</p>
        <p><strong>Studio:</strong> ${studio || 'TBD'}</p>
      </div>

      <p>Please prepare for this session and contact the client if needed.</p>
      <p>Best regards,<br>SVStudio Booking System</p>
    </div>
  `;

  const memberSMS = `SVStudio: New booking! Client: ${customer} (${phone}) on ${formatDate(startDate)} at ${formatTime(startDate)}. ${duration}hr session.`;

  // Send all notifications
  await Promise.all([
    sendEmail(email, clientSubject, clientHtml),
    sendSMS(phone, clientSMS),
    sendEmail(teamMember.email, memberSubject, memberHtml),
    sendSMS(teamMember.phone, memberSMS)
  ]);
}

async function ensureAuth() {
  if (!jwtClient) throw new Error('No JWT client configured');
  if (!jwtClient.authorizePromise) {
    jwtClient.authorizePromise = new Promise((resolve, reject) => {
      jwtClient.authorize((err, tokens) => {
        if (err) return reject(err);
        resolve(tokens);
      });
    });
  }
  return jwtClient.authorizePromise;
}

// Helper: append booking to sheet
async function appendBookingToSheet(booking) {
  if (!SHEET_ID) return;
  const values = [[
    booking.member,
    booking.date,
    booking.start,
    booking.duration,
    booking.customer || '',
    booking.email || '',
    booking.phone || '',
    booking.studio || '',
    booking.created || (new Date()).toISOString()
  ]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A:I',
    valueInputOption: 'USER_ENTERED',
    resource: { values }
  });
}

// Helper: read bookings from sheet (simple read of all rows)
async function readBookingsFromSheet() {
  if (!SHEET_ID) return [];
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A:I'
  });
  const rows = res.data.values || [];
  // Expect header row; convert rows to objects
  const bookings = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    bookings.push({
      member: r[0],
      date: r[1],
      start: parseInt(r[2],10),
      duration: parseInt(r[3],10),
      customer: r[4],
      email: r[5],
      phone: r[6],
      studio: r[7],
      created: r[8]
    });
  }
  return bookings;
}

// API: list bookings for member/date or month
app.get('/api/bookings', async (req, res) => {
  try {
    await ensureAuth();
    const member = req.query.member;
    const date = req.query.date; // YYYY-MM-DD
    const month = req.query.month; // YYYY-MM
    const all = await readBookingsFromSheet();
    let out = all;
    if (member) out = out.filter(b => b.member === member);
    if (date) out = out.filter(b => b.date === date);
    if (month) out = out.filter(b => b.date && b.date.startsWith(month));
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

// API: list unique members from the sheet
app.get('/api/members', async (req, res) => {
  try {
    await ensureAuth();
    const all = await readBookingsFromSheet();
    const names = Array.from(new Set(all.map(b => b.member).filter(Boolean)));
    res.json(names);
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

// API: get pricing information
app.get('/api/pricing', (req, res) => {
  res.json({
    hourlyRate: HOURLY_RATE,
    bookingFee: BOOKING_FEE,
    currency: 'USD'
  });
});

// Helper: check freebusy for given member calendar and times with buffer
async function isFreeInCalendar(startISO, endISO) {
  await ensureAuth();
  const body = { items: [{ id: CALENDAR_ID }], timeMin: startISO, timeMax: endISO };
  const fb = await calendar.freebusy.query({ resource: body });
  const calendars = fb.data.calendars || {};
  const busy = calendars[CALENDAR_ID] && calendars[CALENDAR_ID].busy;
  return !(busy && busy.length > 0);
}

// API: create booking
app.post('/api/bookings', async (req, res) => {
  try {
    await ensureAuth();
    const { member, date, start, duration, customer, email, phone, studio, paymentToken } = req.body;
    if (!member || !date || typeof start !== 'number' || !duration) return res.status(400).json({ error: 'Missing fields' });
    if (duration < MIN_HOURS) return res.status(400).json({ error: `Minimum booking is ${MIN_HOURS} hours` });
    if (duration > MAX_HOURS) return res.status(400).json({ error: `Maximum booking is ${MAX_HOURS} hours` });

    // Validate payment (mock implementation - replace with real payment processing)
    if (!paymentToken) {
      return res.status(400).json({ error: 'Payment required' });
    }

    // Calculate total cost
    const subtotal = HOURLY_RATE * duration;
    const total = subtotal + BOOKING_FEE;

    // Mock payment validation - in real implementation, verify with payment processor
    if (paymentToken !== 'mock_payment_success') {
      return res.status(400).json({ error: 'Payment validation failed' });
    }

    // compute start and end with buffer
    const startDate = new Date(`${date}T${String(start).padStart(2,'0')}:00:00`);
    const endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);

    const bufferBefore = new Date(startDate.getTime() - BUFFER_HOURS * 60 * 60 * 1000);
    const bufferAfter = new Date(endDate.getTime() + BUFFER_HOURS * 60 * 60 * 1000);

    // check calendar freebusy
    const ok = await isFreeInCalendar(bufferBefore.toISOString(), bufferAfter.toISOString());
    if (!ok) return res.status(409).json({ error: 'Time range conflicts with existing calendar events (including buffer)' });

    // Create calendar event in the shared calendar
    const event = {
      summary: `Booking: ${member} — ${customer || 'Client'}`,
      description: `Booking for ${member}. Customer: ${customer || ''} ${email || ''} ${phone || ''}. Total: $${total}`,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() }
    };
    const createdEvent = await calendar.events.insert({ calendarId: CALENDAR_ID, resource: event });

    // Create booking object
    const booking = {
      member,
      date,
      start,
      duration,
      customer,
      email,
      phone,
      studio,
      total: total,
      paymentStatus: 'paid',
      created: new Date().toISOString()
    };

    // Append to sheet
    await appendBookingToSheet(booking);

    // Send notifications
    try {
      await sendBookingNotifications(booking);
    } catch (notificationError) {
      console.error('Notification error:', notificationError);
      // Don't fail the booking if notifications fail
    }

    res.json({ success: true, eventId: createdEvent.data.id, total: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Simple in-memory employee storage (in production, use a database)
let employees = [
  { id: 1, email: 'admin@svstudio.com', password: 'admin123', firstName: 'Admin', lastName: 'User', phone: '555-0100', role: 'studio-manager' }
];

// Authentication endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const employee = employees.find(emp => emp.email === email && emp.password === password);

  if (!employee) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Return employee data (excluding password)
  const { password: _, ...employeeData } = employee;
  res.json({ success: true, employee: employeeData });
});

app.post('/api/auth/signup', (req, res) => {
  const { firstName, lastName, email, phone, password, role } = req.body;

  if (!firstName || !lastName || !email || !phone || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Check if email already exists
  if (employees.some(emp => emp.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  // Create new employee
  const newEmployee = {
    id: employees.length + 1,
    email,
    password, // In production, hash the password
    firstName,
    lastName,
    phone,
    role
  };

  employees.push(newEmployee);

  // Return employee data (excluding password)
  const { password: _, ...employeeData } = newEmployee;
  res.json({ success: true, employee: employeeData });
});

app.listen(PORT, () => {
  console.log(`SVStudio server running on port ${PORT}`);
});
