const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

// Inicializar Firebase Admin
admin.initializeApp();

// Configurar SendGrid con tu API Key
sgMail.setApiKey(functions.config().sendgrid.key);

// Función para enviar email de confirmación
exports.sendConfirmationEmail = functions.firestore
    .document('reservations/{reservationId}')
    .onCreate(async (snapshot, context) => {
        const reservation = snapshot.data();
        const reservationId = context.params.reservationId;

        console.log('🔍 DEBUG: Nueva reserva creada:', reservationId);

        if (reservation.status !== 'pending') {
            return null;
        }

        try {
            await sendConfirmationEmail(reservation, reservationId);
            console.log(`✅ Email enviado para: ${reservationId}`);
            return null;
        } catch (error) {
            console.error('❌ Error:', error);
            await snapshot.ref.update({ 
                status: 'email_failed',
                emailError: error.message 
            });
            return null;
        }
    });

// Función para enviar email final cuando se confirma
exports.sendFinalConfirmation = functions.firestore
    .document('reservations/{reservationId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const reservationId = context.params.reservationId;

        if (before.status === 'pending' && after.status === 'confirmed') {
            try {
                await sendFinalConfirmationEmail(after, reservationId);
                console.log(`✅ Email final enviado: ${reservationId}`);
                return null;
            } catch (error) {
                console.error('❌ Error email final:', error);
                return null;
            }
        }
        return null;
    });

// Función para enviar el email de confirmación (con link)
async function sendConfirmationEmail(reservation, reservationId) {
    const confirmationLink = `https://uiuzanto.github.io/restaurante-reservas/confirm.html?token=${reservation.confirmationToken}&id=${reservationId}`;
    
    const msg = {
        to: reservation.customerEmail,
        from: {
            email: 'johnwilston44@gmail.com',
            name: 'Restaurante Sabores'
        },
        subject: 'Confirma tu reserva - Restaurante Sabores',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #2c5530; color: white; padding: 20px; text-align: center;">
                    <h1>Restaurante Sabores</h1>
                </div>
                <div style="padding: 20px; background: #f9f9f9;">
                    <h2>Confirma tu reserva</h2>
                    <p>Hola <strong>${reservation.customerName}</strong>,</p>
                    <p>Gracias por reservar en Restaurante Sabores.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${confirmationLink}" 
                           style="background: #d4af37; color: white; padding: 12px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Confirmar Reserva
                        </a>
                    </div>
                    
                    <p><strong>Detalles:</strong></p>
                    <ul>
                        <li><strong>Fecha:</strong> ${reservation.date}</li>
                        <li><strong>Hora:</strong> ${reservation.time}</li>
                        <li><strong>Personas:</strong> ${reservation.people}</li>
                        <li><strong>Código:</strong> ${reservation.reservationCode}</li>
                    </ul>
                </div>
            </div>
        `,
        text: `Confirma tu reserva: ${confirmationLink}`
    };

    await sgMail.send(msg);
}

// Función para enviar email final de confirmación
async function sendFinalConfirmationEmail(reservation, reservationId) {
    const msg = {
        to: reservation.customerEmail,
        from: {
            email: 'johnwilston44@gmail.com',
            name: 'Restaurante Sabores'
        },
        subject: '✅ Reserva Confirmada - Restaurante Sabores',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #2c5530; color: white; padding: 20px; text-align: center;">
                    <h1>¡Reserva Confirmada!</h1>
                </div>
                <div style="padding: 20px; background: #f9f9f9;">
                    <p style="color: #2c5530; font-weight: bold;">✅ Tu reserva está confirmada</p>
                    <p>Hola <strong>${reservation.customerName}</strong>,</p>
                    
                    <p><strong>Detalles confirmados:</strong></p>
                    <ul>
                        <li><strong>Fecha:</strong> ${reservation.date}</li>
                        <li><strong>Hora:</strong> ${reservation.time}</li>
                        <li><strong>Personas:</strong> ${reservation.people}</li>
                        <li><strong>Código:</strong> ${reservation.reservationCode}</li>
                    </ul>
                    
                    <p>¡Te esperamos!</p>
                </div>
            </div>
        `
    };

    await sgMail.send(msg);
}

