# SVStudio Website

A simple website for SVStudio, a creative studio hosting practices, photography, podcast, and events.

## Features

- Modern, responsive design with corporate color scheme
- Microphone icon logo in the header
- Dropdown navigation menu for services
- Dedicated team page with member profiles, bios, and booking functionality
- Interactive calendar for viewing and managing bookings
- Contact form with backend integration
- Email and SMS notifications for bookings
- Google Sheets and Calendar integration
- Custom images for all service sections

## Setup

### Prerequisites

- Node.js (v14 or higher)
- Google Cloud Platform account with Google Sheets and Calendar APIs enabled
- Service account key file for Google APIs
- Email service (Gmail, SendGrid, etc.) for notifications
- Twilio account for SMS notifications

### Installation

1. Clone or download the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your configuration:
   ```bash
   cp .env.example .env
   ```

4. Configure the following in your `.env` file:
   - Google Sheets and Calendar API credentials
   - Email service configuration (SMTP settings)
   - Twilio SMS configuration
   - Pricing configuration (hourly rates and fees)
   - Other environment variables

5. Start the server:
   ```bash
   npm start
   ```

## Pricing Configuration

The booking system includes configurable pricing:

- **Hourly Rate**: Set the base rate per hour (default: $75)
- **Booking Fee**: Additional fee per booking (default: $25)

Configure these in your `.env` file:
```env
HOURLY_RATE=75
BOOKING_FEE=25
```

## Checkout Process

The booking flow now includes a mandatory checkout step:

1. **Booking Selection**: User selects team member, date, time, and duration
2. **Review & Checkout**: User reviews booking details and pricing
3. **Payment**: User enters payment information (demo implementation)
4. **Confirmation**: Booking is confirmed only after successful payment validation

### Demo Payment

For testing purposes, use this demo card information:
- **Card Number**: 1234 5678 9012 3456
- **Any expiry date and CVV**
- **Any name**

### Offline Testing

The checkout system includes fallback pricing when the server is not running, allowing you to test the checkout flow even without starting the server. The fallback pricing uses:
- Hourly Rate: $75
- Booking Fee: $25

In production, replace the mock payment system with a real payment processor like Stripe or PayPal.

## Files

- `index.html`: The main HTML file containing the structure of the website.
- `team.html`: Page showcasing the team members with bios and booking options.
- `booking.html`: Booking form for scheduling appointments.
- `calendar.html`: Interactive calendar for viewing team member schedules.
- `style.css`: CSS file for styling the website.
- `script.js`: JavaScript file for interactivity and API calls.
- `server.js`: Node.js backend server with Google APIs integration.
- `images/`: Directory for storing image files.

## Notification System

The booking system includes automatic notifications:

### For Clients:
- **Email**: Professional booking confirmation with all details
- **SMS**: Quick confirmation message with key booking info

### For Team Members:
- **Email**: Detailed booking information with client contact details
- **SMS**: Immediate notification of new bookings

### Configuration

To enable notifications, configure the following in your `.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@svstudio.com

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567
```

### Team Member Contacts

Team member contact information is configured in `server.js`. Update the `teamMembers` object with actual email addresses and phone numbers for each team member.

## Usage

1. Open `index.html` in a web browser to view the website.
2. Navigate through the sections using the menu or by scrolling.
3. Use the team page to view member profiles and book appointments.
4. Use the calendar page to view schedules and manage bookings.
5. The contact form sends messages to the configured email service.

## API Endpoints

- `GET /api/members`: Get list of team members
- `GET /api/bookings`: Get bookings (with optional filters)
- `POST /api/bookings`: Create a new booking
- `POST /api/auth/login`: Employee login
- `POST /api/auth/signup`: Employee registration

## Troubleshooting

- If the website doesn't load, ensure all files are in the same directory.
- For browser compatibility issues, test in modern browsers like Chrome, Firefox, or Edge.
- If JavaScript features don't work, check if JavaScript is enabled in your browser.
- For notification issues, check your email/SMS service configuration and API keys.

## Future Enhancements

- Add images and media for each section.
- Implement payment processing for bookings.
- Add more interactive elements and animations.
- Implement user accounts and profiles.
- Add booking modification and cancellation features.