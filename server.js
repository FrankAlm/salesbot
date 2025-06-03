require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');
const { create } = require('xmlbuilder2'); // <- Korrektur hier!

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Neuer TwiML-Einstiegspunkt für Twilio
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

// Der eigentliche Bot-Endpunkt
app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: "voice_id_abc", // <- Setze hier deinen echten ElevenLabs-Voice-ID ein!
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  try {
    const axios = require('axios');
    const audioBuffer = (await axios.get(audioUrl + ".wav", { responseType: 'arraybuffer' })).data;

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
    console.error(err);
    res.status(500).send("<Response><Say>Es ist ein Fehler aufgetreten.</Say></Response>");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SalesBot mit TwiML läuft auf Port ${PORT}`);
});
