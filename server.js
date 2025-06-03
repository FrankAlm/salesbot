const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const PORT = process.env.PORT || 10000;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const GPT_API_URL = process.env.GPT_API_URL;

app.post('/voice', (req, res) => {
  const twiml = `
    <Response>
      <Say>Hallo! Du sprichst mit dem automatisierten SalesBot. Bitte sag mir, was du suchst.</Say>
      <Record timeout="5" maxLength="30" playBeep="true" />
      <Say>Danke für deine Nachricht. Wir melden uns gleich bei dir.</Say>
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
});

app.post('/recording', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  const callSid = req.body.CallSid || uuidv4();

  console.log(`📥 Recording URL erhalten: ${recordingUrl}`);

  try {
    const audioUrl = `${recordingUrl}.wav`;
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: TWILIO_ACCOUNT_SID,
        password: TWILIO_AUTH_TOKEN
      }
    });

    const filePath = path.join(__dirname, 'recordings', `${callSid}.wav`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, audioResponse.data);
    console.log(`🎧 Audio gespeichert unter: ${filePath}`);

    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('callSid', callSid);

    const gptResponse = await axios.post(GPT_API_URL, form, {
      headers: form.getHeaders()
    });

    console.log('✅ GPT-Antwort:', gptResponse.data);

  } catch (error) {
    console.error('❌ Fehler im Bot:', error.message);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 SalesBot mit TwiML läuft auf Port ${PORT}`);
});
