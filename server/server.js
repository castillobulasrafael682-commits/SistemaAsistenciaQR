require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const supabase = require('./supabase');

const app = express();

// ==========================================
// CONFIGURACIÓN
// ==========================================

app.use(cors());
app.use(express.json());

// Servir archivos de la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// RUTA PRINCIPAL
// ==========================================

// Mostrar directamente la página del escáner QR
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/prueba.html'));
});

// ==========================================
// OBTENER INTEGRANTES
// ==========================================

app.get('/integrantes', async (req, res) => {

  try {

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

  } catch (error) {

    console.error('Error:', error);

    res.status(500).json({
      error: 'Error interno del servidor'
    });

  }

});

// ==========================================
// REGISTRAR ASISTENCIA
// ==========================================

app.post('/api/asistencia', async (req, res) => {

  try {

    const { qr_codigo } = req.body;

    // ==========================================
    // VERIFICAR QR
    // ==========================================

    if (!qr_codigo) {

      return res.status(400).json({
        error: 'No se recibió el código QR'
      });

    }

    console.log('QR recibido:', qr_codigo);

    // ==========================================
    // BUSCAR INTEGRANTE
    // ==========================================

    const {
      data: integrante,
      error: errorIntegrante
    } = await supabase
      .from('Integrantes')
      .select('*')
      .eq('qr_codigo', qr_codigo)
      .eq('activo', true)
      .single();

    // ==========================================
    // VERIFICAR INTEGRANTE
    // ==========================================

    if (errorIntegrante || !integrante) {

      console.error(
        'Integrante no encontrado:',
        errorIntegrante
      );

      return res.status(404).json({
        error: 'Integrante no encontrado o inactivo'
      });

    }

    // ==========================================
    // REGISTRAR ASISTENCIA
    // ==========================================

    const {
      data: asistencia,
      error: errorAsistencia
    } = await supabase
      .from('Asistencia')
      .insert([
        {
          integrante_id: integrante.id,
          tipo: 'entrada'
        }
      ])
      .select()
      .single();

    // ==========================================
    // VERIFICAR REGISTRO
    // ==========================================

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

    console.log(
      'Asistencia registrada:',
      integrante.nombre
    );

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

    console.error('Error interno:', error);

    res.status(500).json({
      error: 'Error interno del servidor'
    });

  }

});

// ==========================================
// INICIAR SERVIDOR
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {

  console.log(
    `Servidor funcionando en el puerto ${PORT}`
  );

});