// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');
const { create } = require('xmlbuilder2');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Eingangspunkt für Twilio
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

// Bot Endpoint
app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: process.env.ELEVENLABS_VOICE_ID,
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  console.log("📥 Recording URL erhalten:", audioUrl);

  try {
    const wavUrl = `${audioUrl}.wav`;
    console.log("🔊 Lade Audio von:", wavUrl);

    const audioBuffer = (await axios.get(wavUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Basic ${Buffer.from(process.env.TWILIO_SID + ':' + process.env.TWILIO_AUTH_TOKEN).toString('base64')}`
      }
    })).data;

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
    res.status(500).send('<Response><Say>Es ist ein Fehler aufgetreten.</Say></Response>');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
