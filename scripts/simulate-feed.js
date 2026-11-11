// Test feeder for development only. Not real production data.
// Usage: node scripts/simulate-feed.js --version V3.1 --count 10
//        node scripts/simulate-feed.js --version V3.0 --count 5

const http = require('http');
const yargs = require('yargs') // Not available, using manual parsing
process.argv.forEach((val, index) => {
  if (val === '--version') version = process.argv[index + 1];
  if (val === '--count') count = process.argv[index + 1];
});

const version = version || 'V3.0';
const count = count || 10;

const versionMap = {
  'V3.0': 2,
  'V3.1': 9,
  'V3.2': 10,
};

const versionId = versionMap[version];
if (versionId === undefined) {
  console.error('Unknown version: ' + version);
  process.exit(1);
}

const baseUrl = 'http://localhost:3001';
const apiPath = '/api/v1/monitor/samples';

const torques = [13.8, 13.5, 12.5, 14.0, 13.2, 13.8, 13.1, 13.9, 13.6, 13.7];
const angles = [74.2, 73.6, 72.4, 74.8, 72.4, 74.2, 73.2, 74.5, 73.9, 74.1];
const results = ['PASS', 'PASS', 'FAIL', 'PASS', 'FAIL', 'PASS', 'FAIL', 'PASS', 'FAIL', 'PASS'];
const failureModes = ['', '', 'F04', '', 'F02', '', 'F05', '', 'F03', ''];

let dataSent = 0;

function sendSample(i) {
  if (i >= count) {
    console.log(`Sent ${dataCount} samples for version ${version}`);
    process.exit(0);
  }

  const sample = {
    versionId: version,
    sample_no: 1020 + i,
    receivedAt: new Date().toISOString(),
    result: results[i],
    confidence: 80 + Math.random() * 20,
    failureMode: failureModes[i],
    torque: torques[i],
    angle: angles[i],
    curve: [
      { angle: 0, torque: 0.2 },
      { angle: 6, torque: 1.6 },
      { angle: 14, torque: 4.2 },
      { angle: 22, torque: 7.4 },
      { angle: 31, torque: 10.1 },
      { angle: 41, torque: 12.3 },
      { angle: 52, torque: 13.5 },
      { angle: 62, torque: 13.9 },
      { angle: 70, torque: 13.8 },
      { angle: 74.2, torque: 13.8 }
    ]
  };

  const postData = JSON.stringify(sample);

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/v1/monitor/samples',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': postData.length
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`Sent sample ${i + 1}/${count}: ${results[i]} - ${data}`);
      dataSent++;
      sendSample(i + 1);
    });
  });

  req.on('error', (e) => {
    console.error(`Error sending sample ${i + 1}: ${e.message}`);
    sendSample(i + 1); // Retry
  });

  req.write(postData);
  req.end();
}

sendSample(0);