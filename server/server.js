require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const supabase = require('./supabase');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
    res.sendFile(
        path.join(__dirname, '../public/prueba.html')
    );
});


// =====================================================
// OBTENER INTEGRANTES
// =====================================================

app.get('/integrantes', async (req, res) => {

    const { data, error } = await supabase
        .from('Integrantes')
        .select('*')
        .eq('activo', true);

    if (error) {

        console.error(
            'Error obteniendo integrantes:',
            error
        );

        return res.status(500).json({
            error: 'Error obteniendo integrantes'
        });
    }

    res.json(data);
});


// =====================================================
// ENVIAR MENSAJE A TELEGRAM
// =====================================================

async function enviarTelegram(mensaje) {

    const url =
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;

    const respuesta = await fetch(url, {

        method: 'POST',

        headers: {
            'Content-Type': 'application/json'
        },

        body: JSON.stringify({

            chat_id:
                process.env.TELEGRAM_CHAT_ID,

            text:
                mensaje

        })

    });

    const datos =
        await respuesta.json();

    if (
        !respuesta.ok ||
        !datos.ok
    ) {

        throw new Error(
            datos.description ||
            'Error enviando mensaje a Telegram'
        );

    }

    return datos;
}


// =====================================================
// REGISTRAR ASISTENCIA
// =====================================================

app.post('/api/asistencia', async (req, res) => {

    try {

        const { qr_codigo } =
            req.body;


        console.log(
            'QR recibido:',
            qr_codigo
        );


        // =================================================
        // VALIDAR QR
        // =================================================

        if (!qr_codigo) {

            return res.status(400).json({

                error:
                    'No se recibió ningún código QR'

            });

        }


        // =================================================
        // BUSCAR INTEGRANTE
        // =================================================

        const {
            data: integrante,
            error: errorIntegrante
        } = await supabase

            .from('Integrantes')

            .select('*')

            .eq(
                'qr_codigo',
                qr_codigo
            )

            .eq(
                'activo',
                true
            )

            .single();


        if (
            errorIntegrante ||
            !integrante
        ) {

            console.log(
                'QR no encontrado'
            );

            return res.status(404).json({

                error:
                    'Código QR no válido'

            });

        }


        console.log(
            'Persona encontrada:',
            integrante.nombre
        );


        // =================================================
        // OBTENER FECHA ACTUAL DE MÉXICO
        // =================================================

        const ahora =
            new Date();


        const partesFecha =
            new Intl.DateTimeFormat(
                'en-CA',
                {

                    timeZone:
                        'America/Mexico_City',

                    year:
                        'numeric',

                    month:
                        '2-digit',

                    day:
                        '2-digit'

                }
            ).formatToParts(
                ahora
            );


        const año =
            partesFecha.find(
                parte =>
                    parte.type === 'year'
            ).value;


        const mes =
            partesFecha.find(
                parte =>
                    parte.type === 'month'
            ).value;


        const dia =
            partesFecha.find(
                parte =>
                    parte.type === 'day'
            ).value;


        const inicioDiaMexico =
            `${año}-${mes}-${dia}T00:00:00-06:00`;


        const finDiaMexico =
            `${año}-${mes}-${dia}T23:59:59-06:00`;


        // =================================================
        // COMPROBAR SI YA REGISTRÓ HOY
        // =================================================

        const {
            data: asistenciaExistente,
            error: errorDuplicado
        } = await supabase

            .from('Asistencia')

            .select(
                'id, registrado_en'
            )

            .eq(
                'integrante_id',
                integrante.id
            )

            .gte(
                'registrado_en',
                inicioDiaMexico
            )

            .lte(
                'registrado_en',
                finDiaMexico
            )

            .order(
                'registrado_en',
                {
                    ascending:
                        false
                }
            )

            .limit(1)

            .maybeSingle();


        if (errorDuplicado) {

            console.error(
                'Error comprobando duplicado:',
                errorDuplicado
            );

            return res.status(500).json({

                error:
                    'No se pudo comprobar la asistencia'

            });

        }


        // =================================================
        // YA REGISTRÓ HOY
        // =================================================

        if (asistenciaExistente) {

            console.log(
                'Asistencia duplicada:',
                integrante.nombre
            );


            return res.status(409).json({

                duplicado:
                    true,

                error:
                    'Esta asistencia ya fue registrada hoy',

                integrante: {

                    nombre:
                        integrante.nombre,

                    numero_integrante:
                        integrante.numero_integrante

                },

                asistencia: {

                    registrado_en:
                        asistenciaExistente.registrado_en

                }

            });

        }


        // =================================================
        // REGISTRAR NUEVA ASISTENCIA
        // =================================================

        const {

            data: asistencia,
            error: errorAsistencia

        } = await supabase

            .from('Asistencia')

            .insert([{

                integrante_id:
                    integrante.id,

                tipo:
                    'Entrada',

                observacion:
                    null

            }])

            .select()

            .single();


        if (errorAsistencia) {

            console.error(
                'Error registrando asistencia:',
                errorAsistencia
            );

            return res.status(500).json({

                error:
                    'No se pudo registrar la asistencia'

            });

        }


        console.log(
            'Asistencia registrada:',
            integrante.nombre
        );


        // =================================================
        // FECHA Y HORA DE MÉXICO
        // =================================================

        const fecha =
            new Date(
                asistencia.registrado_en
            );


        const fechaMexico =
            fecha.toLocaleDateString(
                'es-MX',
                {

                    timeZone:
                        'America/Mexico_City',

                    day:
                        '2-digit',

                    month:
                        '2-digit',

                    year:
                        'numeric'

                }
            );


        const horaMexico =
            fecha.toLocaleTimeString(
                'en-US',
                {

                    timeZone:
                        'America/Mexico_City',

                    hour:
                        'numeric',

                    minute:
                        '2-digit',

                    hour12:
                        true

                }
            );


        // =================================================
        // MENSAJE TELEGRAM
        // =================================================

        const mensajeTelegram =

            '✅ REGISTRO DE ASISTENCIA\n\n' +

            '👤 ' +
            integrante.nombre +
            '\n' +

            '🔢 Número: ' +
            integrante.numero_integrante +
            '\n\n' +

            '📅 Fecha: ' +
            fechaMexico +
            '\n' +

            '🕐 Hora: ' +
            horaMexico +
            '\n\n' +

            '⛪ Liturgia Altepexi';


        // =================================================
        // ENVIAR TELEGRAM
        // =================================================

        try {

            await enviarTelegram(
                mensajeTelegram
            );

            console.log(
                'Telegram enviado correctamente'
            );

        }
        catch (errorTelegram) {

            console.error(
                'Error enviando Telegram:',
                errorTelegram.message
            );

        }


        // =================================================
        // RESPUESTA AL HTML
        // =================================================

        res.json({

            ok:
                true,

            integrante: {

                nombre:
                    integrante.nombre,

                numero_integrante:
                    integrante.numero_integrante

            },

            asistencia: {

                registrado_en:
                    asistencia.registrado_en

            }

        });


    }
    catch (error) {

        console.error(
            'Error general:',
            error
        );

        res.status(500).json({

            error:
                'Error interno del servidor'

        });

    }

});


// =====================================================
// SERVIDOR
// =====================================================

const PORT =
    process.env.PORT ||
    3000;


app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `Servidor funcionando en puerto ${PORT}`
        );

    }
);