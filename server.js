require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');
const { create } = require('xmlbuilder2');
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Twilio-Einstiegspunkt
app.post('/twilio-entry', (req, res) => {
  const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Response')
      .ele('Say')
        .att('voice', 'alice')
        .att('language', 'de-DE')
        .txt('Bitte sprechen Sie jetzt. Ich höre zu.')
      .up()
      .ele('Pause').att('length', '1').up()
      .ele('Record')
        .att('action', '/agent/offer_igniter')
        .att('method', 'POST')
        .att('maxLength', '10')
        .att('playBeep', 'true')
    .end({ prettyPrint: true });

  res.type('text/xml');
  res.send(responseXml);
});

// Bot-Endpunkt mit robustem Retry
app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: process.env.ELEVENLABS_VOICE_ID, // in .env definiert
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  console.log("📥 Recording URL erhalten:", audioUrl + ".wav");

  try {
    // Audio-Datei mit Retry laden
    const maxRetries = 5;
    let attempt = 0;
    let audioBuffer = null;

    while (attempt < maxRetries) {
      try {
        const response = await axios.get(audioUrl + ".wav", {
          responseType: 'arraybuffer',
          auth: {
            username: process.env.TWILIO_ACCOUNT_SID,
            password: process.env.TWILIO_AUTH_TOKEN
          }
        });

        audioBuffer = response.data;
        console.log("✅ Audio erfolgreich geladen beim Versuch", attempt + 1);
        break;
      } catch (err) {
        attempt++;
        console.warn(`⚠️ Versuch ${attempt} fehlgeschlagen: ${err.response?.status || err.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (!audioBuffer) {
      console.error("❌ Audio konnte nicht geladen werden.");
      return res.status(500).send("<Response><Say>Die Audioaufnahme konnte nicht verarbeitet werden.</Say></Response>");
    }

    // Verarbeitung
    const transcript = await transcribe(audioBuffer);
    const reply = await askGPT(transcript, config.prompt);
    const spokenUrl = await speak(reply, config.voice_id);

    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Play')
          .txt(spokenUrl)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);

  } catch (err) {
    console.error("❌ Fehler im Bot:", err);
    res.status(500).send("<Response><Say>Ein interner Fehler ist aufgetreten.</Say></Response>");
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
