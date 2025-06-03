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

// 🎯 Twilio Einstiegspunkt – erster TwiML-Response
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

// 🤖 Haupt-Bot-Logik nach Sprachaufnahme
app.post('/agent/offer_igniter', async (req, res) => {
  try {
    const recordingUrl = req.body.RecordingUrl;
    console.log("📥 Recording URL erhalten:", recordingUrl);

    // Lade Audio mit Twilio Basic Auth
    const audioResponse = await axios.get(recordingUrl + '.wav', {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    const audioBuffer = audioResponse.data;
    console.log("🔊 Audio geladen");

    // Transkribieren & GPT-Antwort generieren
    const transcript = await transcribe(audioBuffer);
    console.log("📝 Transkript:", transcript);

    const prompt = "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell.";
    const reply = await askGPT(transcript, prompt);
    console.log("💬 GPT-Antwort:", reply);

    // Sprachausgabe generieren (Voice-ID anpassen!)
    const voiceId = "voice_id_abc"; // <- Echte ElevenLabs Voice-ID einsetzen
    const spokenUrl = await speak(reply, voiceId);
    console.log("🔈 Sprachausgabe bereit:", spokenUrl);

    // Sende TwiML zurück mit Sprachausgabe
    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Play')
          .txt(spokenUrl)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);

  } catch (error) {
    console.error("❌ Fehler im Bot:", error);
    res.status(500).send("<Response><Say>Es ist ein Fehler aufgetreten.</Say></Response>");
  }
});

// 🔁 Serverstart
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
