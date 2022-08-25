const express = require("express");
const app = express();
const server = require("http").createServer(app);
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

var nodemailer = require("nodemailer");
var sgTransport = require("nodemailer-sendgrid-transport");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

//

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    method: ["GET", "POST"],
  },
});

const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

//VerifyJWT
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    console.log("decoded", decoded);
    req.decoded = decoded;
    next();
  });
}

// mongoDB user information
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bvzmv.mongodb.net/?retryWrites=true&w=majority`;

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
    const eventCollection = client.db("eventData").collection("events");
    const invitationEventCollection = client
      .db("invitationEvent")
      .collection("invitation");

    //AUTH(JWT)
    app.post("/login", async (req, res) => {
      const user = req.body;
      const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ accessToken });
    });

    // get all users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = userCollection.find(query);
      const newUsers = await users.toArray();
      res.send(newUsers);
    });

    // app.get('/admin/:email', async (req, res) => {
    //   const email = req.params.email;
    //   const user = await userCollection.findOne({ email: email });
    //   const isAdmin = user.role === 'admin';
    //   res.send({ admin: isAdmin })
    // })

    app.put("/user/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        const filter = { email: email };
        const updateDoc = {
          $set: { role: "admin" },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    });

    //user schedule
    app.get("/userSchedule", async (req, res) => {
      const userSchedule = await eventCollection.find().toArray();
      res.send(userSchedule);
    });

    // post user
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      console.log("adding new user", newUser);
      const result = await userCollection.insertOne(newUser);
      res.send(result);
    });

    // S user - create a new OneOnOne event api
    app.post("/event/create/OneOnOne", async (req, res) => {
      const newEvent = req.body;
      console.log(newEvent);
      const result = await eventCollection.insertOne(newEvent);
      SendConfirmEmail(newEvent);
      res.send(result);
    });
    // S user - create a new group event api
    app.post("/event/create/group", async (req, res) => {
      const newEvent = req.body;
      console.log(newEvent);
      const result = await eventCollection.insertOne(newEvent);

      SendConfirmEmail(newEvent);
      res.send(result);
    });
    // S user - get events api
    app.get("/event/group/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await eventCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // S user - get event api
    app.get("/event/single/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await eventCollection.findOne(query);
      res.send(result);
    });
    // Scheduled Events - get Upcoming events api
    app.get("/event/group/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await eventCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // find specific user by user's id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    // S user - get events api
    app.get("/event/group/:email", async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await eventCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();

      res.send(result);
    });

    // get data for notification
    app.get("/event/invitation/:email", async (req, res) => {
      const email = req.params.email;
      const query = { emails: email };
      const result = await invitationEventCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(result);
    });

    // S user - post invitation invitationEventCollection
    app.post("/event/invitation", async (req, res) => {
      const invitation = req.body;
      console.log(invitation?.emails);
      const result = await invitationEventCollection.insertOne(invitation);
      SendGuestEmail(
        invitation?.finalData.userEvent,
        invitation?.emails,
        invitation?.finalData?.inviteTime
      );
      res.send(result);
    });
    //  // S user - get invitation invitationEventCollection
    app.get("/event/invitation/single/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await invitationEventCollection.findOne(query);
      console.log(query);
      res.send(result);
    });

    // All User-get invitation invitationEventCollection

    app.get("/event/invited/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await invitationEventCollection.find(query).toArray();
      res.send(result);
    });

    // find specific user by user's id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });
    // S user - get event api
    app.get("/event/single/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await eventCollection.findOne(query);
      res.send(result);
    });

    // update user
    app.put("/users/:id", async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;
      const query = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          name: updatedUser.name,
          ages: updatedUser.ages,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc, options);
      res.send(result);
    });

    // delete user
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    //------------ / --------------

    // Payment
    app.post("/create-payment-intent", async (req, res) => {
      const service = req.body;
      const totalPrice = service.totalPrice;
      const amount = totalPrice * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    //------------ / --------------
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("EasySchedule server-side is working fine");
});

// socket- for video call

io.on("connection", (socket) => {
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    socket.broadcast.emit("callended");
  });

  socket.on("calluser", ({ userToCall, signalData, from, name }) => {
    io.to(userToCall).emit("calluser", { signal: signalData, from, name });
  });

  socket.on("answercall", (data) => {
    io.to(data.to).emit("callaccepted", data.signal);
  });

  socket.on("cm", (camera, mic) => {
    socket.broadcast.emit("cm", camera, mic);
  });
});

app.listen(port, () => {
  console.log("EasySchedule app is listening on port", port);
});

// nodemailer for user
function SendConfirmEmail(newEvent) {
  const {
    eventName,
    userName,
    userEmail,
    eventDate,
    eventTime,
    eventDuration,
    description,
    location,
  } = newEvent;
  const msg = {
    from: "aatozz99@gmail.com",
    to: "jabedhtusar@gmail.com",
    subject: "Meeting Schedule",
    text: "Meeting Schedule",
    html: ` <h3> Hi ${userName} </h3>
    <p>
    We hope you’re doing well. You have created a meeting to discuss <b> ${eventName} </b>.
    Hope you will enjoy your meeting time and it looks like <b> ${eventDate} </b> 
    at <b> ${eventTime} </b>. Meeting at/on <b> ${location} </b>.
    </p>
    
    Kind regards, 
    <br>
    Easy Schedule
    </p>`,
  };
  nodemailer
    .createTransport({
      service: "gmail",
      auth: {
        user: "aatozz99@gmail.com",
        pass: "olbozzxqlqxdngvy",
      },
    })
    .sendMail(msg, (err) => {
      if (err) {
        return console.log("error ".err);
      } else {
        return console.log("email sent");
      }
    });
}

// nodemailer for guest
function SendGuestEmail(invitation, emails, newInviteTime) {
  const {
    eventName,
    userName,
    userEmail,
    eventDate,
    eventTime,
    eventDuration,
    description,
    location,
  } = invitation;
  const msg = {
    from: "aatozz99@gmail.com",
    to: `${emails}`,
    subject: "Meeting Schedule",
    text: "Meeting Schedule",
    html: ` <h3> Hi there </h3>
    <p>
    I hope you’re doing well. It’s time for us to meet to discuss <b> ${eventName} </b>.
    I looked at everyone’s availability on Easy Schedule, and it looks like <b> ${eventDate} </b> 
    at <b> ${newInviteTime} </b> will work best for everyone. 
    Let’s meet at/on <b> ${location} </b>.
    </p>
    <p>
    We’ll need about ${eventDuration} min. In that time, we should be able to cover:
    Please use <a href='https://easy-schedule-77cce.web.app/'>this link</a> to let me know whether you’ll be able to make it. 
    I look forward to seeing you all.
    <br>
    Kind regards, 
    <br>
    ${userName},
    </p>`,
  };
  nodemailer
    .createTransport({
      service: "gmail",
      auth: {
        user: "aatozz99@gmail.com",
        pass: "olbozzxqlqxdngvy",
      },
    })
    .sendMail(msg, (err) => {
      if (err) {
        return console.log("error ".err);
      } else {
        return console.log("email sent");
      }
    });
}
