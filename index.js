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

        // Solo procesar reservas pendientes
        if (reservation.status !== 'pending') {
            console.log('Reserva no pendiente, ignorando email');
            return null;
        }

        try {
            // Enviar email de confirmación
            await sendConfirmationEmail(reservation, reservationId);
            console.log(`Email de confirmación enviado para reserva: ${reservationId}`);
            
            return null;
        } catch (error) {
            console.error('Error enviando email de confirmación:', error);
            
            // Marcar reserva como fallida
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

        // Solo procesar si cambió de pending a confirmed
        if (before.status === 'pending' && after.status === 'confirmed') {
            try {
                await sendFinalConfirmationEmail(after, reservationId);
                console.log(`Email final enviado para reserva confirmada: ${reservationId}`);
                
                return null;
            } catch (error) {
                console.error('Error enviando email final:', error);
                return null;
            }
        }
        
        return null;
    });

// Función para enviar el email de confirmación (con link)
async function sendConfirmationEmail(reservation, reservationId) {
    const confirmationLink = `http://localhost:5500/confirm.html?token=${reservation.confirmationToken}&id=${reservationId}`;
    
    const msg = {
        to: reservation.customerEmail,
        from: {
            email: 'johnwilston44@gmail.com',
            name: 'Restaurante Sabores'
        },
        subject: 'Confirma tu reserva - Restaurante Sabores',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2c5530; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .button { background: #d4af37; color: white; padding: 12px 30px; 
                             text-decoration: none; border-radius: 5px; display: inline-block; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Restaurante Sabores</h1>
                    </div>
                    <div class="content">
                        <h2>Confirma tu reserva</h2>
                        <p>Hola <strong>${reservation.customerName}</strong>,</p>
                        <p>Gracias por reservar en Restaurante Sabores. Por favor confirma tu reserva haciendo clic en el siguiente botón:</p>
                        
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="${confirmationLink}" class="button">Confirmar Reserva</a>
                        </p>
                        
                        <p><strong>Detalles de tu reserva:</strong></p>
                        <ul>
                            <li><strong>Fecha:</strong> ${reservation.date}</li>
                            <li><strong>Hora:</strong> ${reservation.time}</li>
                            <li><strong>Personas:</strong> ${reservation.people}</li>
                            <li><strong>Código:</strong> ${reservation.reservationCode}</li>
                        </ul>
                        
                        <p><em>Si no confirmas tu reserva en 24 horas, será cancelada automáticamente.</em></p>
                    </div>
                    <div class="footer">
                        <p>Restaurante Sabores • Calle Principal 123 • +34 912 345 678</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
            Confirma tu reserva - Restaurante Sabores
            
            Hola ${reservation.customerName},
            
            Gracias por reservar en Restaurante Sabores. 
            Confirma tu reserva visitando este enlace:
            ${confirmationLink}
            
            Detalles de tu reserva:
            - Fecha: ${reservation.date}
            - Hora: ${reservation.time}
            - Personas: ${reservation.people}
            - Código: ${reservation.reservationCode}
            
            Si no confirmas en 24 horas, será cancelada.
            
            Restaurante Sabores
            Calle Principal 123
            +34 912 345 678
        `
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
        subject: 'Reserva Confirmada - Restaurante Sabores',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2c5530; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                    .confirmed { color: #2c5530; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>¡Reserva Confirmada!</h1>
                    </div>
                    <div class="content">
                        <p class="confirmed">✅ Tu reserva ha sido confirmada exitosamente</p>
                        
                        <p>Hola <strong>${reservation.customerName}</strong>,</p>
                        <p>Estamos emocionados de recibirte en Restaurante Sabores.</p>
                        
                        <p><strong>Detalles de tu reserva confirmada:</strong></p>
                        <ul>
                            <li><strong>Fecha:</strong> ${reservation.date}</li>
                            <li><strong>Hora:</strong> ${reservation.time}</li>
                            <li><strong>Personas:</strong> ${reservation.people}</li>
                            <li><strong>Código de reserva:</strong> ${reservation.reservationCode}</li>
                            ${reservation.specialRequests ? `<li><strong>Notas especiales:</strong> ${reservation.specialRequests}</li>` : ''}
                        </ul>
                        
                        <p><strong>Información importante:</strong></p>
                        <ul>
                            <li>Por favor llega 10 minutos antes de tu reserva</li>
                            <li>Trae tu código de reserva (${reservation.reservationCode})</li>
                            <li>Ubicación: Calle Principal 123, Ciudad</li>
                            <li>Teléfono: +34 912 345 678</li>
                        </ul>
                        
                        <p>¡Esperamos verte pronto!</p>
                    </div>
                    <div class="footer">
                        <p>Restaurante Sabores • Calle Principal 123 • +34 912 345 678</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
            Reserva Confirmada - Restaurante Sabores
            
            ✅ Tu reserva ha sido confirmada exitosamente
            
            Hola ${reservation.customerName},
            
            Estamos emocionados de recibirte en Restaurante Sabores.
            
            Detalles de tu reserva confirmada:
            - Fecha: ${reservation.date}
            - Hora: ${reservation.time}
            - Personas: ${reservation.people}
            - Código: ${reservation.reservationCode}
            ${reservation.specialRequests ? `- Notas: ${reservation.specialRequests}` : ''}
            
            Información importante:
            • Llega 10 minutos antes
            • Trae tu código: ${reservation.reservationCode}
            • Ubicación: Calle Principal 123
            • Teléfono: +34 912 345 678
            
            ¡Esperamos verte pronto!
            
            Restaurante Sabores
        `
    };

    await sgMail.send(msg);
}