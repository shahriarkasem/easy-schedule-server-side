const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const ObjectId = require("mongodb").ObjectId;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();

//
const server = require("http").createServer(app);

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
      const result = await eventCollection.insertOne(newEvent);
      res.send(result);
    });
    // S user - create a new group event api
    app.post("/event/create/group", async (req, res) => {
      const newEvent = req.body;
      const result = await eventCollection.insertOne(newEvent);
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

    // find specific user by user's id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // find specific user by user's id
    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await userCollection.findOne(query);
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
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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

  socket.on("camMic", (camera, mic) => {
    socket.broadcast.emit("camMic", camera, mic);
  });
});

app.listen(port, () => {
  console.log("EasySchedule app is listening on port", port);
});

// front end server api

/* 
// GET ALL USERS API From Client Side
useEffect(() => {
    fetch("http://localhost:5000/users")
      .then((res) => res.json())
      .then((data) => setGet(data));
  },[]);


      // Post data

      fetch("http://localhost:5000/users", {
      method: "POST", or PUT
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(allData),
    })
      .then((res) => res.json())
      .then((data) => {
        // const newData = [...get, data];
        // setGet(newData);
        console.log(data);
        alert("user added successfully");
        e.target.reset()
      });

     // DELETE API From Client Side

      const handleDelete = (id) => {
    console.log("i got your id", id);
    fetch(`http://localhost:5000/users/${id}`, {
      method: "DELETE",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.deletedCount > 0) {
          const remaining = users.filter((user) => user._id !== id);
          setUsers(remaining);
          console.log(data);
        }
      });
  };

// update API from client side

  const handleForm = (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const ages = e.target.ages.value;
    const address = e.target.address.value;
    console.log(name, ages, address);
    const allData = { name, ages, address };
    fetch(`http://localhost:5000/users/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(allData),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log(data);
        alert("user added successfully");
        e.target.reset();
      });
  };
*/
