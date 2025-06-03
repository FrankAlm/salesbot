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

// 📞 Einstiegspunkt von Twilio
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

// 🧠 Bot-Logik nach Aufnahme
app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: process.env.ELEVEN_VOICE_ID || "voice_id_abc",
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  console.log("📥 Recording URL erhalten:", audioUrl);

  try {
    const audioBuffer = await tryDownloadAudioWithRetry(audioUrl + ".wav", 3, 1000);
    console.log("✅ Audio erfolgreich geladen.");

    const transcript = await transcribe(audioBuffer);
    console.log("📝 Transkript:", transcript);

    const reply = await askGPT(transcript, config.prompt);
    console.log("🤖 GPT-Antwort:", reply);

    const spokenUrl = await speak(reply, config.voice_id);
    console.log("🔊 Audio-Antwort URL:", spokenUrl);

    const responseXml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Response')
        .ele('Play').txt(spokenUrl)
      .end({ prettyPrint: true });

    res.type('text/xml');
    res.send(responseXml);
  } catch (err) {
    console.error("❌ Fehler im Bot:", err.message);
    res.status(500).send('<Response><Say>Es ist ein Fehler aufgetreten.</Say></Response>');
  }
});

// 🕒 Retry-Logik für verzögertes Audio von Twilio
async function tryDownloadAudioWithRetry(url, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return response.data;
    } catch (err) {
      console.warn(`⚠️ Versuch ${i + 1} fehlgeschlagen: ${err.message}`);
      if (i < retries - 1) await wait(delayMs);
    }
  }
  throw new Error("Audio konnte nicht heruntergeladen werden.");
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
