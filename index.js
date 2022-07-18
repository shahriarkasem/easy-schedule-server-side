const express = require('express');
const app = express();
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('EasySchedule server-side is working fine')
})

app.listen(port, () => {
    console.log('EasySchedule app is listening on port', port)
})