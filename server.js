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

app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: process.env.ELEVEN_VOICE_ID || "voice_id_abc",
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  console.log("📥 Recording URL erhalten:", audioUrl);

  try {
    if (!audioUrl) throw new Error("Keine RecordingUrl erhalten.");

    const fullAudioUrl = audioUrl + ".wav";
    console.log("🔊 Lade Audio von:", fullAudioUrl);
    const audioBuffer = (await axios.get(fullAudioUrl, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_SID}:${process.env.TWILIO_TOKEN}`).toString('base64')}`
      }
    })).data;

    const transcript = await transcribe(audioBuffer);
    console.log("📝 Transkript:", transcript);

    const reply = await askGPT(transcript, config.prompt);
    console.log("🤖 GPT-Antwort:", reply);

    const spokenUrl = await speak(reply, config.voice_id);
    console.log("🗣️ Audio-URL:", spokenUrl);

    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Play').txt(spokenUrl)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);

  } catch (err) {
    console.error("❌ Fehler im Bot:", err.message || err);

    const debugMessage = err.message || "Unbekannter Fehler";
    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Say')
          .att('voice', 'alice')
          .att('language', 'de-DE')
          .txt("Fehler: " + debugMessage)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
