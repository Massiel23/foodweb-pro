const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/profile?userId=1',
    method: 'GET',
    headers: {
        'x-restaurant-id': '1',
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        console.log('BODY:', data);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
