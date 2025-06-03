require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { transcribe } = require('./deepgram');
const { askGPT } = require('./gpt');
const { speak } = require('./elevenlabs');
const { xml } = require('xmlbuilder2');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Neuer TwiML-Einstiegspunkt für Twilio
app.post('/twilio-entry', (req, res) => {
  const responseXml = xml({
    Response: {
      Say: { '@voice': 'alice', '@language': 'de-DE', '#': 'Bitte sprechen Sie jetzt. Ich höre zu.' },
      Pause: { '@length': '1' },
      Record: {
        '@action': '/agent/offer_igniter',
        '@method': 'POST',
        '@maxLength': '10',
        '@playBeep': 'true'
      }
    }
  }).end({ prettyPrint: true });

  res.type('text/xml');
  res.send(responseXml);
});

// Der eigentliche Bot-Endpunkt
app.post('/agent/offer_igniter', async (req, res) => {
  const audioUrl = req.body.RecordingUrl;
  const config = {
    voice_id: "voice_id_abc",
    prompt: "Du bist ein Verkaufsberater für das Programm Offer Igniter. Sei freundlich, überzeugend und professionell."
  };

  try {
    const axios = require('axios');
    const audioBuffer = (await axios.get(audioUrl + ".wav", { responseType: 'arraybuffer' })).data;

    const transcript = await transcribe(audioBuffer);
    const reply = await askGPT(transcript, config.prompt);
    const spokenUrl = await speak(reply, config.voice_id);

    const responseXml = xml({
      Response: {
        Play: spokenUrl
      }
    }).end({ prettyPrint: true });

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