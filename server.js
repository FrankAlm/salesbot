require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');
const { create } = require('xmlbuilder2');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// ✅ Einstiegspunkt für Twilio
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

// ✅ Bot-Logik nach Aufnahme
app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: "voice_id_abc", // ❗ Ersetze durch echte ElevenLabs-Voice-ID
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  try {
    console.log(`📥 Recording URL erhalten: ${audioUrl}`);
    const fullAudioUrl = audioUrl; // ❗ FIX: Kein ".wav" mehr anhängen!
    console.log(`🔊 Lade Audio von: ${fullAudioUrl}`);

    const audioBuffer = (await axios.get(fullAudioUrl, {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      },
      responseType: 'arraybuffer'
    })).data;

    const transcript = await transcribe(audioBuffer);
    const reply = await askGPT(transcript, config.prompt);
    const spokenUrl = await speak(reply, config.voice_id);

    console.log(`🧠 GPT: ${reply}`);
    console.log(`🔈 Generierte Sprachausgabe: ${spokenUrl}`);

    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Play').txt(spokenUrl)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);
  } catch (err) {
    console.error("❌ Fehler im Bot:", err);
    res.status(500).send(`<Response><Say>Es ist ein Fehler aufgetreten.</Say></Response>`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
