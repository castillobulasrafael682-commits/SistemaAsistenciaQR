require('dotenv').config();

const express = require('express');
const cors = require('cors');
const supabase = require('./supabase');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ==========================================
// RUTA PRINCIPAL
// ==========================================

app.get('/', (req, res) => {
  res.send('Servidor de asistencia funcionando correctamente 🚀');
});


// ==========================================
// OBTENER INTEGRANTES
// ==========================================

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


// ==========================================
// REGISTRAR ASISTENCIA
// ==========================================

app.post('/api/asistencia', async (req, res) => {

  try {

    const { qr_codigo } = req.body;

    // Verificar que recibimos el QR
    if (!qr_codigo) {

      return res.status(400).json({
        error: 'No se recibió el código QR'
      });

    }


    // ==========================================
    // BUSCAR INTEGRANTE
    // ==========================================

    const { data: integrante, error: errorIntegrante } =
      await supabase
        .from('Integrantes')
        .select('*')
        .eq('qr_codigo', qr_codigo)
        .eq('activo', true)
        .single();


    // Si no encontramos al integrante
    if (errorIntegrante || !integrante) {

      return res.status(404).json({
        error: 'Integrante no encontrado o inactivo'
      });

    }


    // ==========================================
    // REGISTRAR ASISTENCIA
    // ==========================================

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


    // Verificar error de registro
    if (errorAsistencia) {

      console.error(
        'Error registrando asistencia:',
        errorAsistencia
      );

      return res.status(500).json({
        error: errorAsistencia.message
      });

    }


    // ==========================================
    // RESPUESTA
    // ==========================================

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

    console.error('Error:', error);

    res.status(500).json({
      error: 'Error interno del servidor'
    });

  }

});


// ==========================================
// INICIAR SERVIDOR
// ==========================================

// Render proporcionará PORT.
// Cuando trabajemos localmente utilizará 3000.

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    `Servidor funcionando en el puerto ${PORT}`
  );

});