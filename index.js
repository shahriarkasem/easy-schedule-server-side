const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

// mongoDB user information
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wecty.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// connect with database
async function run() {
  try {
    await client.connect();
    const userCollection = client.db("userData").collection("users");

    // user
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      console.log("adding new user", newUser);
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("EasySchedule server-side is working fine");
});

app.listen(port, () => {
  console.log("EasySchedule app is listening on port", port);
});
