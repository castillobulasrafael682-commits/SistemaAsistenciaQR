require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');

const app = express();

app.use(cors());
app.use(express.json());

// Servir la página pública
app.use(express.static(path.join(__dirname, '../public')));

// Página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/prueba.html'));
});

// Obtener integrantes
app.get('/integrantes', async (req, res) => {
  const { data, error } = await supabase
    .from('Integrantes')
    .select('*');

  if (error) {
    console.error('Error de Supabase:', error);

    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data);
});

// =====================================================
// FUNCIÓN PARA ENVIAR MENSAJES A TELEGRAM
// =====================================================

async function enviarTelegram(mensaje) {

  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const respuesta = await fetch(url, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: mensaje
    })
  });

  const datos = await respuesta.json();

  if (!respuesta.ok || !datos.ok) {
    throw new Error(
      datos.description || 'Error enviando mensaje a Telegram'
    );
  }

  return datos;
}

// =====================================================
// REGISTRAR ASISTENCIA
// =====================================================

app.post('/api/asistencia', async (req, res) => {

  try {

    const { qr_codigo } = req.body;

    // Verificar que llegó el QR
    if (!qr_codigo) {

      return res.status(400).json({
        error: 'No se recibió el código QR'
      });

    }

    console.log('QR recibido:', qr_codigo);

    // Buscar integrante
    const { data: integrante, error: errorIntegrante } =
      await supabase
        .from('Integrantes')
        .select('*')
        .eq('qr_codigo', qr_codigo)
        .eq('activo', true)
        .single();

    // Si no existe
    if (errorIntegrante || !integrante) {

      console.error(
        'Integrante no encontrado:',
        errorIntegrante
      );

      return res.status(404).json({
        error: 'Integrante no encontrado o inactivo'
      });

    }

    console.log(
      'Integrante encontrado:',
      integrante.nombre
    );

    // Registrar asistencia en Supabase
    const { data: asistencia, error: errorAsistencia } =
      await supabase
        .from('Asistencia')
        .insert([
          {
            integrante_id: integrante.id,
            tipo: 'entrada'
          }
        ])
        .select()
        .single();

    // Error al guardar asistencia
    if (errorAsistencia) {

      console.error(
        'Error registrando asistencia:',
        errorAsistencia
      );

      return res.status(500).json({
        error: errorAsistencia.message
      });

    }

    console.log(
      'Asistencia registrada:',
      asistencia.id
    );

    // =================================================
    // FECHA Y HORA DE MÉXICO
    // =================================================

    const fecha = new Date(asistencia.registrado_en);

    const fechaMexico =
      fecha.toLocaleDateString('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

    const horaMexico =
      fecha.toLocaleTimeString('en-US', {
        timeZone: 'America/Mexico_City',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

    // =================================================
    // MENSAJE DE TELEGRAM
    // =================================================

    const mensajeTelegram =

`📋 NUEVA ASISTENCIA

👤 Integrante: ${integrante.nombre}
🔢 Número: ${integrante.numero_integrante}
📅 Fecha: ${fechaMexico}
🕐 Hora: ${horaMexico}

✅ Entrada registrada`;

    // =================================================
    // ENVIAR TELEGRAM
    // =================================================

    try {

      await enviarTelegram(mensajeTelegram);

      console.log(
        'Mensaje enviado correctamente a Telegram'
      );

    } catch (errorTelegram) {

      // Si Telegram falla, NO eliminamos la asistencia
      console.error(
        'Error enviando Telegram:',
        errorTelegram.message
      );

    }

    // =================================================
    // RESPUESTA AL CELULAR
    // =================================================

    res.json({

      mensaje: 'Asistencia registrada correctamente',

      integrante: {
        id: integrante.id,
        nombre: integrante.nombre,
        numero_integrante: integrante.numero_integrante
      },

      asistencia: asistencia

    });

  } catch (error) {

    console.error(
      'Error interno:',
      error
    );

    res.status(500).json({
      error: 'Error interno del servidor'
    });

  }

});

// =====================================================
// INICIAR SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    `Servidor funcionando en el puerto ${PORT}`
  );

});