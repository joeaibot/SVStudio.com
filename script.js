// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Highlight current page in navigation
document.addEventListener('DOMContentLoaded', function() {
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('nav a');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === 'index.html' && href === '#home')) {
            link.classList.add('active');
        }
    });
});

// Contact form handling
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const message = document.getElementById('contact-message').value.trim();

        // Basic validation
        if (!name || !email || !message) {
            alert('Please fill in all fields');
            return;
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address');
            return;
        }

        // Success message
        alert('Thank you for your message! We will get back to you within 24 hours.');

        // Clear form
        contactForm.reset();
    });
}

// Book member function
function bookMember(name) {
    // Redirect to booking page with member preselected
    window.location.href = 'booking.html?member=' + encodeURIComponent(name);
}

// --- Booking calendar logic ---
function getBookings() {
    // Try server first
    return getBookingsFromServerFallback();
}

function saveBookings(bookings) {
    localStorage.setItem('svstudio_bookings', JSON.stringify(bookings));
}

function addBooking(booking) {
    // Try to POST to server; fallback to localStorage
    return addBookingToServer(booking).catch((error) => {
        const bookings = JSON.parse(localStorage.getItem('svstudio_bookings') || '[]');
        bookings.push(booking);
        localStorage.setItem('svstudio_bookings', JSON.stringify(bookings));
        return Promise.resolve(booking);
    });
}

function bookingsFor(member, dateStr) {
    // If server available, fetch specific bookings
    const serverUrl = `/api/bookings?member=${encodeURIComponent(member)}&date=${encodeURIComponent(dateStr)}`;
    return fetch(serverUrl).then(r => r.json()).catch(() => {
        return (JSON.parse(localStorage.getItem('svstudio_bookings') || '[]')).filter(b => b.member === member && b.date === dateStr);
    });
}

function isRangeAvailable(member, dateStr, startHour, duration) {
    // Call server side availability if possible
    // For simplicity, check bookings fetched locally if server not available
    return bookingsFor(member, dateStr).then(bks => {
        for (const b of bks) {
            const a1 = b.start;
            const a2 = b.start + b.duration;
            const r1 = startHour;
            const r2 = startHour + duration;
            if (r1 < a2 && a1 < r2) return false;
        }
        return true;
    }).catch(() => true);
}

// Server helpers
function addBookingToServer(booking) {
    return fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking)
    }).then(r => {
        if (!r.ok) return r.json().then(err => Promise.reject(err));
        return r.json();
    });
}

function getBookingsFromServerFallback() {
    // this function kept for compatibility; client code now prefers fetch per-call
    try {
        return JSON.parse(localStorage.getItem('svstudio_bookings') || '[]');
    } catch {
        return [];
    }
}

// Utility to get query param
function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

// Fetch members from server and populate datalist `members`
function fetchMembers() {
    const list = document.getElementById('members');
    if (!list) return Promise.resolve();
    return fetch('/api/members')
        .then(r => r.json())
        .then(names => {
            list.innerHTML = '';
            names.forEach(n => {
                const opt = document.createElement('option'); opt.value = n; list.appendChild(opt);
            });
        }).catch(() => Promise.resolve());
}

// Booking page rendering
function renderSlots(member) {
    const dateInput = document.getElementById('booking-date');
    const dateStr = dateInput.value;
    const container = document.getElementById('slots');
    container.innerHTML = '';
    if (!dateStr || !member) return;
    // fetch bookings for the day from server; fallback to localStorage
    fetch(`/api/bookings?member=${encodeURIComponent(member)}&date=${encodeURIComponent(dateStr)}`)
        .then(r => r.json())
        .then(bks => {
            const booked = bks.map(b => ({ start: b.start, duration: b.duration }));
            renderSlotElements(booked, member, dateStr);
        })
        .catch(() => {
            const local = (JSON.parse(localStorage.getItem('svstudio_bookings') || '[]')).filter(b => b.member === member && b.date === dateStr);
            const booked = local.map(b => ({ start: b.start, duration: b.duration }));
            renderSlotElements(booked, member, dateStr);
        });
}

function renderSlotElements(booked, member, dateStr) {
    const container = document.getElementById('slots');
    container.innerHTML = '';
    const startHour = 8; // 8 AM
    const endHour = 20; // 8 PM
    for (let h = startHour; h < endHour; h++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.hour = h;
        const label = (h % 12 === 0) ? 12 : h % 12;
        const ampm = h < 12 ? 'AM' : 'PM';
        slot.textContent = `${label}:00 ${ampm}`;
        let blocked = false;
        for (const b of booked) {
            if (h >= b.start && h < b.start + b.duration) { blocked = true; break; }
        }
        if (blocked) {
            slot.classList.add('booked');
            slot.title = 'Booked';
        } else {
            slot.addEventListener('click', () => {
                container.querySelectorAll('.slot.selected').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
            });
        }
        container.appendChild(slot);
    }
    // render month calendar for quick navigation
    renderMonthCalendar(member, dateStr.slice(0,7));
}

function renderMonthCalendar(member, monthStr) {
    const container = document.getElementById('calendar-month');
    container.innerHTML = '';

    if (!member || !monthStr) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Please select a team member and month to view the calendar.</p>';
        return;
    }

    const [year, month] = monthStr.split('-').map(s => parseInt(s, 10));
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];

    // Create calendar container
    const calendarDiv = document.createElement('div');
    calendarDiv.className = 'calendar-container';

    // Calendar header with navigation
    const headerDiv = document.createElement('div');
    headerDiv.className = 'calendar-header';

    const titleDiv = document.createElement('h3');
    titleDiv.className = 'calendar-title';
    titleDiv.textContent = `${monthNames[month - 1]} ${year}`;
    headerDiv.appendChild(titleDiv);

    const navDiv = document.createElement('div');
    navDiv.className = 'calendar-nav';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Previous';
    prevBtn.onclick = () => {
        const prevDate = new Date(year, month - 2, 1);
        const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('month-input').value = prevMonthStr;
        renderMonthCalendar(member, prevMonthStr);
    };
    navDiv.appendChild(prevBtn);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Next →';
    nextBtn.onclick = () => {
        const nextDate = new Date(year, month, 1);
        const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('month-input').value = nextMonthStr;
        renderMonthCalendar(member, nextMonthStr);
    };
    navDiv.appendChild(nextBtn);

    headerDiv.appendChild(navDiv);
    calendarDiv.appendChild(headerDiv);

    // Create calendar grid
    const gridDiv = document.createElement('div');
    gridDiv.className = 'calendar-grid';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(dayName => {
        const headerCell = document.createElement('div');
        headerCell.className = 'calendar-day-header';
        headerCell.textContent = dayName;
        gridDiv.appendChild(headerCell);
    });

    // Get month data
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        gridDiv.appendChild(emptyCell);
    }

    // Add cells for each day of the month
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    // Try to fetch bookings from server, fallback to localStorage
    fetch(`/api/bookings?member=${encodeURIComponent(member)}&month=${encodeURIComponent(monthStr)}`)
        .then(r => r.json())
        .catch(() => {
            // Fallback to localStorage
            return JSON.parse(localStorage.getItem('svstudio_bookings') || '[]')
                .filter(b => b.member === member && b.date.startsWith(monthStr));
        })
        .then(bookings => {
            for (let day = 1; day <= daysInMonth; day++) {
                const dayCell = document.createElement('div');
                const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;

                // Check if this is today
                const isToday = (year === currentYear && month === currentMonth && day === currentDay);

                dayCell.className = `calendar-day${isToday ? ' today' : ''}`;

                // Day number
                const dayNumber = document.createElement('div');
                dayNumber.className = 'day-number';
                dayNumber.textContent = day;
                dayCell.appendChild(dayNumber);

                // Count bookings for this day
                const dayBookings = bookings.filter(b => b.date === dateStr);
                if (dayBookings.length > 0) {
                    dayCell.classList.add('has-bookings');

                    const bookingsInfo = document.createElement('div');
                    bookingsInfo.className = 'day-bookings';
                    bookingsInfo.innerHTML = `<strong>${dayBookings.length}</strong> booking${dayBookings.length !== 1 ? 's' : ''}`;
                    dayCell.appendChild(bookingsInfo);
                }

                // Click handler to select the day
                dayCell.onclick = () => {
                    // Update the month input to match
                    document.getElementById('month-input').value = monthStr;

                    // Set booking date for slots rendering
                    let dateEl = document.getElementById('booking-date');
                    if (!dateEl) {
                        dateEl = document.createElement('input');
                        dateEl.type = 'date';
                        dateEl.id = 'booking-date';
                        dateEl.style.display = 'none';
                        document.body.appendChild(dateEl);
                    }
                    dateEl.value = dateStr;

                    // Render slots and bookings for selected day
                    renderSlots(member);
                    renderBookingsList();

                    // Highlight selected day
                    document.querySelectorAll('.calendar-day').forEach(cell => {
                        cell.classList.remove('selected');
                    });
                    dayCell.classList.add('selected');
                };

                gridDiv.appendChild(dayCell);
            }

            calendarDiv.appendChild(gridDiv);
            container.appendChild(calendarDiv);
        })
        .catch(error => {
            console.error('Error loading calendar:', error);
            container.innerHTML = '<p style="text-align: center; color: #c0392b; padding: 2rem;">Unable to load calendar. Please try again later.</p>';
        });
}

function initBookingPage() {
    const memberField = document.getElementById('member-name');
    const memberFromQuery = getQueryParam('member');
    fetchMembers();
    if (memberFromQuery && memberField) memberField.value = memberFromQuery;

    const dateInput = document.getElementById('booking-date');
    if (dateInput) {
        const today = new Date().toISOString().slice(0,10);
        dateInput.value = today;
        dateInput.addEventListener('change', () => {
            renderSlots(document.getElementById('member-name').value);
            renderBookingsList();
        });
    }

    const memberSelect = document.getElementById('member-name');
    if (memberSelect) {
        memberSelect.addEventListener('change', () => {
            renderSlots(memberSelect.value);
            renderBookingsList();
        });
    }

    document.getElementById('checkout-btn').addEventListener('click', function() {
        const member = document.getElementById('member-name').value;
        const dateStr = document.getElementById('booking-date').value;
        const selected = document.querySelector('.slot.selected');
        const duration = parseInt(document.getElementById('duration').value, 10) || 1;
        const firstName = document.getElementById('first-name').value.trim();
        const lastName = document.getElementById('last-name').value.trim();
        const email = document.getElementById('customer-email').value.trim();
        const phone = document.getElementById('phone-number').value.trim();
        const studio = document.getElementById('studio').value;

        if (!member || !dateStr || !selected || !studio || !firstName || !lastName || !email || !phone) {
            alert('Please fill in all required fields: team member, date, studio, start hour, and your information.');
            return;
        }

        const startHour = parseInt(selected.dataset.hour, 10);
        if (!isRangeAvailable(member, dateStr, startHour, duration)) {
            alert('Selected time range is not available.');
            return;
        }

        // Show checkout modal with booking details
        showCheckoutModal({
            member,
            dateStr,
            startHour,
            duration,
            firstName,
            lastName,
            email,
            phone,
            studio
        });
    });

    // initial render
    if (memberFromQuery) setTimeout(() => renderSlots(memberFromQuery), 50);
    renderBookingsList();
}

function renderBookingsList() {
    const list = document.getElementById('bookings-list');
    if (!list) return;
    const member = document.getElementById('member-name').value;
    const dateStr = document.getElementById('booking-date').value;
    list.innerHTML = '';
    if (!member || !dateStr) return;
    const bks = bookingsFor(member, dateStr);
    if (bks.length === 0) { list.textContent = 'No bookings for this day.'; return; }
    const ul = document.createElement('ul');
    for (const b of bks) {
        const li = document.createElement('li');
        const start = b.start;
        const end = b.start + b.duration;
        const sLabel = `${(start%12===0?12:start%12)}:00 ${start<12?'AM':'PM'}`;
        const eLabel = `${(end%12===0?12:end%12)}:00 ${end<12?'AM':'PM'}`;
        li.textContent = `${sLabel} - ${eLabel} — ${b.customer || 'Customer'} (${b.email || 'no email'}, ${b.phone || 'no phone'}) - ${b.studio || 'Studio'}`;
        ul.appendChild(li);
    }
    list.appendChild(ul);
}

// If booking page loaded, initialize
if (window.location.pathname.endsWith('booking.html')) {
    window.addEventListener('DOMContentLoaded', initBookingPage);
}

// Checkout modal functionality
let currentBookingData = null;
let pricingData = null;

function showCheckoutModal(bookingData) {
    currentBookingData = bookingData;

    // Fetch pricing if not already loaded
    if (!pricingData) {
        fetch('/api/pricing')
            .then(r => {
                if (!r.ok) {
                    throw new Error('Server not available');
                }
                return r.json();
            })
            .then(data => {
                pricingData = data;
                populateCheckoutModal(bookingData);
                document.getElementById('checkout-modal').style.display = 'block';
            })
            .catch((error) => {
                console.log('Server pricing not available, using fallback:', error.message);
                // Fallback pricing for when server is not running
                pricingData = {
                    hourlyRate: 75,
                    bookingFee: 25,
                    currency: 'USD'
                };
                populateCheckoutModal(bookingData);
                document.getElementById('checkout-modal').style.display = 'block';
            });
    } else {
        populateCheckoutModal(bookingData);
        document.getElementById('checkout-modal').style.display = 'block';
    }
}

function populateCheckoutModal(data) {
    const { member, dateStr, startHour, duration, firstName, lastName, email, phone, studio } = data;

    // Format date
    const date = new Date(dateStr);
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Format time
    const startTime = formatTime(startHour);
    const endTime = formatTime(startHour + duration);

    // Populate summary
    document.getElementById('summary-member').textContent = member;
    document.getElementById('summary-date').textContent = formattedDate;
    document.getElementById('summary-time').textContent = `${startTime} - ${endTime}`;
    document.getElementById('summary-duration').textContent = `${duration} hour${duration > 1 ? 's' : ''}`;
    document.getElementById('summary-studio').textContent = studio;
    document.getElementById('summary-client').textContent = `${firstName} ${lastName}`;

    // Calculate pricing
    const subtotal = pricingData.hourlyRate * duration;
    const total = subtotal + pricingData.bookingFee;

    // Populate pricing
    document.getElementById('hourly-rate-display').textContent = pricingData.hourlyRate;
    document.getElementById('duration-display').textContent = duration;
    document.getElementById('subtotal-display').textContent = subtotal.toFixed(2);
    document.getElementById('booking-fee-display').textContent = pricingData.bookingFee.toFixed(2);
    document.getElementById('total-display').textContent = total.toFixed(2);
}

function formatTime(hour) {
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
}

// Modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Close modal when clicking X
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            document.getElementById('checkout-modal').style.display = 'none';
        });
    }

    // Close modal when clicking outside
    const modal = document.getElementById('checkout-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Cancel checkout
    const cancelBtn = document.getElementById('cancel-checkout-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.getElementById('checkout-modal').style.display = 'none';
        });
    }

    // Confirm booking
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', processCheckout);
    }

    // Format card number input
    const cardNumberInput = document.getElementById('card-number');
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '');
            value = value.replace(/\D/g, '');
            value = value.substring(0, 16);
            value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
            e.target.value = value;
        });
    }

    // Format expiry date input
    const expiryInput = document.getElementById('expiry-date');
    if (expiryInput) {
        expiryInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 2) {
                value = value.substring(0, 4);
                value = value.replace(/(\d{2})(\d{0,2})/, '$1/$2');
            }
            e.target.value = value;
        });
    }
});

function processCheckout() {
    // Validate payment fields (demo validation)
    const cardNumber = document.getElementById('card-number').value.trim().replace(/\s/g, '');
    const expiryDate = document.getElementById('expiry-date').value.trim();
    const cvv = document.getElementById('cvv').value.trim();
    const cardName = document.getElementById('card-name').value.trim();

    if (!cardNumber || !expiryDate || !cvv || !cardName) {
        alert('Please fill in all payment fields.');
        return;
    }

    // Demo payment validation - in real implementation, verify with payment processor
    if (cardNumber !== '1234567890123456') {
        alert('Demo payment failed. Use card number: 1234 5678 9012 3456');
        return;
    }

    // Disable button to prevent double submission
    const confirmBtn = document.getElementById('confirm-booking-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing...';

    // Create booking with payment
    const { member, dateStr, startHour, duration, firstName, lastName, email, phone, studio } = currentBookingData;
    const customer = `${firstName} ${lastName}`;

    const booking = {
        member,
        date: dateStr,
        start: startHour,
        duration,
        customer,
        email,
        phone,
        studio,
        paymentToken: 'mock_payment_success' // In real implementation, this would be from payment processor
    };

    addBooking(booking)
        .then(() => {
            document.getElementById('checkout-modal').style.display = 'none';
            alert('Booking confirmed and payment processed successfully!');
            renderSlots(member);
            renderBookingsList();

            // Clear payment form
            document.getElementById('card-number').value = '';
            document.getElementById('expiry-date').value = '';
            document.getElementById('cvv').value = '';
            document.getElementById('card-name').value = '';
        })
        .catch(error => {
            alert('Booking failed: ' + error.message);
        })
        .finally(() => {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Complete Booking';
        });
}