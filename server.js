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

// Bot-Antwort-Endpoint
app.post('/agent/offer_igniter', async (req, res) => {
  try {
    const audioUrl = req.body.RecordingUrl;
    console.log("📥 Recording URL erhalten:", audioUrl);

    if (!audioUrl) {
      throw new Error("Keine RecordingUrl übermittelt!");
    }

    const fullAudioUrl = `${audioUrl}.wav`;
    console.log("🔊 Lade Audio von:", fullAudioUrl);

    const audioResponse = await axios.get(fullAudioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = audioResponse.data;

    console.log("🎙 Starte Transkription...");
    const transcript = await transcribe(audioBuffer);
    console.log("📝 Transkription:", transcript);

    const prompt = "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell.";
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Beispiel: Rachel (ersetzen!)

    console.log("💬 Frage an GPT...");
    const reply = await askGPT(transcript, prompt);
    console.log("🤖 GPT-Antwort:", reply);

    console.log("🗣 Erzeuge Sprachausgabe...");
    const spokenUrl = await speak(reply, voiceId);
    console.log("🔗 Audio-URL:", spokenUrl);

    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Play')
          .txt(spokenUrl)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);

  } catch (err) {
    console.error("❌ Fehler im Bot:", err.message);
    res.status(500).send(`<Response><Say>Es ist ein Fehler aufgetreten.</Say></Response>`);
  }
});

// Server starten
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
