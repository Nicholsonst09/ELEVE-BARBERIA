// Data
let appointments = [
    {
        id: '1',
        time: '09:00',
        client: 'Carlos Mendoza',
        service: 'Corte + Barba',
        duration: 45,
        price: 25,
        phone: '+1234567890',
        status: 'confirmado'
    },
    {
        id: '2',
        time: '10:00',
        client: 'Ana García',
        service: 'Corte Mujer',
        duration: 60,
        price: 30,
        phone: '+1234567891',
        status: 'pendiente'
    },
    {
        id: '3',
        time: '11:30',
        client: 'Luis Rodríguez',
        service: 'Corte Clásico',
        duration: 30,
        price: 18,
        phone: '+1234567892',
        status: 'confirmado'
    },
    {
        id: '4',
        time: '14:00',
        client: 'María López',
        service: 'Peinado',
        duration: 90,
        price: 40,
        phone: '+1234567893',
        status: 'completado'
    }
];

const financialData = {
    week: {
        period: 'Esta Semana',
        services: { total: 45, revenue: 1125, growth: 12.5 },
        products: { total: 18, revenue: 540, growth: 8.3 },
        totalRevenue: 1665,
        totalGrowth: 10.8
    },
    month: {
        period: 'Este Mes',
        services: { total: 180, revenue: 4500, growth: 15.2 },
        products: { total: 72, revenue: 2160, growth: 22.1 },
        totalRevenue: 6660,
        totalGrowth: 17.5
    }
};

const serviceBreakdown = [
    { name: 'Corte Clásico', count: 25, revenue: 450, percentage: 40 },
    { name: 'Corte + Barba', count: 15, revenue: 375, percentage: 33 },
    { name: 'Corte Mujer', count: 8, revenue: 240, percentage: 18 },
    { name: 'Peinado', count: 5, revenue: 200, percentage: 11 }
];

const productSales = [
    { name: 'Shampoo Premium', units: 8, revenue: 240, percentage: 44 },
    { name: 'Cera para Cabello', units: 6, revenue: 180, percentage: 33 },
    { name: 'Aceite para Barba', units: 4, revenue: 120, percentage: 22 }
];

const serviceOptions = [
    { value: 'corte-clasico', name: 'Corte Clásico', price: 18, duration: 30 },
    { value: 'corte-barba', name: 'Corte + Barba', price: 25, duration: 45 },
    { value: 'corte-mujer', name: 'Corte Mujer', price: 30, duration: 60 },
    { value: 'peinado', name: 'Peinado', price: 40, duration: 90 }
];

let currentEditingAppointment = null;
let isEditMode = false;


const navButtons = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const currentDateElement = document.getElementById('current-date');
const datePicker = document.getElementById('date-picker');
const periodSelector = document.getElementById('period-selector');
const appointmentModal = document.getElementById('appointment-modal');
const appointmentForm = document.getElementById('appointment-form');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    initializeDate();
    setupEventListeners();
    renderAppointments();
    updateStats();
    renderFinancialData('week');
    populateServiceOptions();
});

function initializeDate() {
    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    currentDateElement.textContent = formattedDate;
    datePicker.value = today.toISOString().split('T')[0];
}

function setupEventListeners() {
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });


    datePicker.addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const formattedDate = selectedDate.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        currentDateElement.textContent = formattedDate;
    });


    periodSelector.addEventListener('change', function() {
        renderFinancialData(this.value);
    });


    appointmentForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (isEditMode) {
            updateAppointment();
        } else {
            addNewAppointment();
        }
    });


    document.getElementById('service-type').addEventListener('change', function() {
        updateDurationAndPrice();
    });

    appointmentModal.addEventListener('click', function(e) {
        if (e.target === appointmentModal) {
            closeAppointmentModal();
        }
    });


    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && appointmentModal.classList.contains('active')) {
            closeAppointmentModal();
        }
    });
}

// Tab Navigation
function switchTab(tabId) {
    // Update navigation
    navButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    // Update content
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

// Service Options
function populateServiceOptions() {
    const serviceSelect = document.getElementById('service-type');
    serviceSelect.innerHTML = '<option value="">Seleccionar servicio</option>';
    
    serviceOptions.forEach(service => {
        const option = document.createElement('option');
        option.value = service.value;
        option.textContent = `${service.name} - $${service.price}`;
        option.setAttribute('data-price', service.price);
        option.setAttribute('data-duration', service.duration);
        serviceSelect.appendChild(option);
    });
}

function updateDurationAndPrice() {
    const serviceSelect = document.getElementById('service-type');
    const selectedOption = serviceSelect.options[serviceSelect.selectedIndex];
    
    if (selectedOption && selectedOption.value) {
        const duration = selectedOption.getAttribute('data-duration');
        console.log(`Selected service duration: ${duration} minutes`);
    }
}

function renderAppointments() {
    const appointmentsList = document.getElementById('appointments-list');
    appointmentsList.innerHTML = '';

    if (appointments.length === 0) {
        appointmentsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #718096;">
                <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p style="font-size: 1.125rem; font-weight: 500;">No hay citas programadas para hoy</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem;">Haz clic en "Nueva Cita" para programar una</p>
            </div>
        `;
        return;
    }


    const sortedAppointments = [...appointments].sort((a, b) => a.time.localeCompare(b.time));

    sortedAppointments.forEach(appointment => {
        const appointmentElement = createAppointmentElement(appointment);
        appointmentsList.appendChild(appointmentElement);
    });
}

function createAppointmentElement(appointment) {
    const div = document.createElement('div');
    div.className = 'appointment-item';
    div.innerHTML = `
        <div class="appointment-time">
            <div class="time">${appointment.time}</div>
            <div class="duration">${appointment.duration}min</div>
        </div>
        <div class="appointment-details">
            <div class="appointment-client">
                <h4>${appointment.client}</h4>
                <span class="status-badge-appointment status-${appointment.status}">${appointment.status}</span>
            </div>
            <div class="appointment-service">${appointment.service}</div>
            <div class="appointment-meta">
                <span class="appointment-phone">
                    <i class="fas fa-phone"></i>
                    ${appointment.phone}
                </span>
                <span class="appointment-price">$${appointment.price}</span>
            </div>
        </div>
        <div class="appointment-actions">
            <button class="btn-icon" onclick="editAppointment('${appointment.id}')" title="Editar cita">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon" onclick="toggleAppointmentStatus('${appointment.id}')" title="Cambiar estado">
                <i class="fas fa-check-circle"></i>
            </button>
            <button class="btn-icon delete" onclick="deleteAppointment('${appointment.id}')" title="Eliminar cita">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return div;
}

function updateStats() {
    const totalAppointments = appointments.length;
    const confirmedAppointments = appointments.filter(a => a.status === 'confirmado').length;
    const pendingAppointments = appointments.filter(a => a.status === 'pendiente').length;
    const completedAppointments = appointments.filter(a => a.status === 'completado').length;
    const dailyRevenue = appointments.reduce((sum, a) => sum + a.price, 0);

    document.getElementById('total-appointments').textContent = totalAppointments;
    document.getElementById('confirmed-appointments').textContent = confirmedAppointments;
    document.getElementById('pending-appointments').textContent = pendingAppointments;
    document.getElementById('daily-revenue').textContent = `$${dailyRevenue}`;
}


function openNewAppointmentModal() {
    isEditMode = false;
    currentEditingAppointment = null;
    

    document.querySelector('.modal-header h3').textContent = 'Programar Nuevo Turno';
    document.querySelector('button[type="submit"]').textContent = 'Programar Turno';

    appointmentForm.reset();
    
   
    appointmentModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    

    setTimeout(() => {
        document.getElementById('client-name').focus();
    }, 100);
}

function editAppointment(id) {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) {
        showNotification('Cita no encontrada', 'error');
        return;
    }

    isEditMode = true;
    currentEditingAppointment = appointment;
    
    document.querySelector('.modal-header h3').textContent = 'Editar Cita';
    document.querySelector('button[type="submit"]').textContent = 'Actualizar Cita';
    

    document.getElementById('client-name').value = appointment.client;
    document.getElementById('client-phone').value = appointment.phone;
    document.getElementById('appointment-time').value = appointment.time;
    

    const serviceSelect = document.getElementById('service-type');
    const serviceOption = serviceOptions.find(s => s.name === appointment.service);
    if (serviceOption) {
        serviceSelect.value = serviceOption.value;
    }
    

    appointmentModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    

    setTimeout(() => {
        document.getElementById('client-name').focus();
    }, 100);
}

function closeAppointmentModal() {
    appointmentModal.classList.remove('active');
    document.body.style.overflow = '';
    appointmentForm.reset();
    isEditMode = false;
    currentEditingAppointment = null;
}

function addNewAppointment() {
    const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const serviceType = document.getElementById('service-type').value;
    const appointmentTime = document.getElementById('appointment-time').value;


    if (!clientName || !clientPhone || !serviceType || !appointmentTime) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }

    
    const existingAppointment = appointments.find(a => a.time === appointmentTime);
    if (existingAppointment) {
        showNotification('Ya existe una cita programada para esa hora', 'error');
        return;
    }

    const serviceOption = serviceOptions.find(s => s.value === serviceType);
    if (!serviceOption) {
        showNotification('Servicio no válido', 'error');
        return;
    }

    const newAppointment = {
        id: Date.now().toString(),
        time: appointmentTime,
        client: clientName,
        service: serviceOption.name,
        duration: serviceOption.duration,
        price: serviceOption.price,
        phone: clientPhone,
        status: 'pendiente'
    };

    appointments.push(newAppointment);
    
    renderAppointments();
    updateStats();
    closeAppointmentModal();
    
    showNotification(`Cita programada para ${clientName} a las ${appointmentTime}`, 'success');
}

function updateAppointment() {
    if (!currentEditingAppointment) {
        showNotification('Error: No se encontró la cita a editar', 'error');
        return;
    }

    const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const serviceType = document.getElementById('service-type').value;
    const appointmentTime = document.getElementById('appointment-time').value;

   
    if (!clientName || !clientPhone || !serviceType || !appointmentTime) {
        showNotification('Por favor completa todos los campos', 'error');
        return;
    }

    
    const existingAppointment = appointments.find(a => 
        a.time === appointmentTime && a.id !== currentEditingAppointment.id
    );
    if (existingAppointment) {
        showNotification('Ya existe una cita programada para esa hora', 'error');
        return;
    }

    const serviceOption = serviceOptions.find(s => s.value === serviceType);
    if (!serviceOption) {
        showNotification('Servicio no válido', 'error');
        return;
    }

    
    const appointmentIndex = appointments.findIndex(a => a.id === currentEditingAppointment.id);
    if (appointmentIndex !== -1) {
        appointments[appointmentIndex] = {
            ...currentEditingAppointment,
            time: appointmentTime,
            client: clientName,
            service: serviceOption.name,
            duration: serviceOption.duration,
            price: serviceOption.price,
            phone: clientPhone
        };

        renderAppointments();
        updateStats();
        closeAppointmentModal();
        
        showNotification(`Cita de ${clientName} actualizada correctamente`, 'success');
    } else {
        showNotification('Error al actualizar la cita', 'error');
    }
}

function toggleAppointmentStatus(id) {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) {
        showNotification('Cita no encontrada', 'error');
        return;
    }

    
    const statusCycle = {
        'pendiente': 'confirmado',
        'confirmado': 'completado',
        'completado': 'pendiente'
    };

    appointment.status = statusCycle[appointment.status] || 'pendiente';
    
    renderAppointments();
    updateStats();
    
    const statusNames = {
        'pendiente': 'Pendiente',
        'confirmado': 'Confirmado',
        'completado': 'Completado'
    };
    
    showNotification(`Estado cambiado a: ${statusNames[appointment.status]}`, 'info');
}

function deleteAppointment(id) {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) {
        showNotification('Cita no encontrada', 'error');
        return;
    }

    if (confirm(`¿Estás seguro de que quieres eliminar la cita de ${appointment.client} a las ${appointment.time}?`)) {
        appointments = appointments.filter(a => a.id !== id);
        renderAppointments();
        updateStats();
        showNotification(`Cita de ${appointment.client} eliminada`, 'success');
    }
}


function renderFinancialData(period) {
    const data = financialData[period];
    

    document.getElementById('total-revenue').textContent = formatCurrency(data.totalRevenue);
    document.getElementById('services-count').textContent = data.services.total;
    document.getElementById('services-revenue').textContent = formatCurrency(data.services.revenue);
    document.getElementById('products-count').textContent = data.products.total;
    document.getElementById('products-revenue').textContent = formatCurrency(data.products.revenue);

   
    document.getElementById('avg-service').textContent = formatCurrency(data.services.revenue / data.services.total);
    document.getElementById('avg-product').textContent = formatCurrency(data.products.revenue / data.products.total);
    document.getElementById('services-per-day').textContent = Math.round(data.services.total / (period === 'week' ? 7 : 30));
    document.getElementById('revenue-per-day').textContent = formatCurrency(data.totalRevenue / (period === 'week' ? 7 : 30));

    renderServicesBreakdown();
    renderProductsBreakdown();
}

function renderServicesBreakdown() {
    const container = document.getElementById('services-breakdown');
    container.innerHTML = '';

    serviceBreakdown.forEach(service => {
        const div = document.createElement('div');
        div.className = 'breakdown-item';
        div.innerHTML = `
            <div class="breakdown-header">
                <span class="breakdown-name">${service.name}</span>
                <span class="breakdown-count">${service.count} servicios</span>
            </div>
            <div class="breakdown-footer">
                <div class="progress-bar">
                    <div class="progress-fill services" style="width: ${service.percentage}%"></div>
                </div>
                <span class="breakdown-revenue">${formatCurrency(service.revenue)}</span>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderProductsBreakdown() {
    const container = document.getElementById('products-breakdown');
    container.innerHTML = '';

    productSales.forEach(product => {
        const div = document.createElement('div');
        div.className = 'breakdown-item';
        div.innerHTML = `
            <div class="breakdown-header">
                <span class="breakdown-name">${product.name}</span>
                <span class="breakdown-count">${product.units} unidades</span>
            </div>
            <div class="breakdown-footer">
                <div class="progress-bar">
                    <div class="progress-fill products" style="width: ${product.percentage}%"></div>
                </div>
                <span class="breakdown-revenue">${formatCurrency(product.revenue)}</span>
            </div>
        `;
        container.appendChild(div);
    });
}


function showNotification(message, type = 'info') {
 
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

  
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 400px;
    `;

    notification.querySelector('.notification-content').style.cssText = `
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `;

    notification.querySelector('.notification-close').style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0.25rem;
        margin-left: auto;
    `;

    document.body.appendChild(notification);

 
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#48bb78';
        case 'error': return '#e53e3e';
        case 'warning': return '#ed8936';
        default: return '#4299e1';
    }
}


function formatCurrency(amount) {
    return new Intl.NumberFormat('es-AR', { 
        style: 'currency',
        currency: 'ARS', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
    }).format(amount);
}
function generateTimeSlots() {
    const slots = [];
    for (let hour = 8; hour < 20; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            slots.push(timeString);
        }
    }
    return slots;
}


document.addEventListener('DOMContentLoaded', function() {
    const timeSelect = document.getElementById('appointment-time');
    if (timeSelect) {
        const timeSlots = generateTimeSlots();
        timeSlots.forEach(time => {
            const option = document.createElement('option');
            option.value = time;
            option.textContent = time;
            timeSelect.appendChild(option);
        });
    }
});

window.openNewAppointmentModal = openNewAppointmentModal;
window.closeNewAppointmentModal = closeAppointmentModal;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.toggleAppointmentStatus = toggleAppointmentStatus;


if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addNewAppointment,
        editAppointment,
        deleteAppointment,
        updateStats,
        formatCurrency
    };
}