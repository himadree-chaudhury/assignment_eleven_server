require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};

// label: Middleware
app.use(cors(corsOptions));
app.use(express.json());

// label: MongoDB Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.lhej2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    //   label: Database Connection
    const database = client.db(process.env.DB_NAME);
    const carCollection = database.collection("cars");
    const bookingsCollection = database.collection("bookings");

    // label : Cars Routes
    // label : Get All Cars
    app.get("/cars", async (req, res) => {
      const cars = carCollection.find();
      const result = await cars.toArray();
      res.send(result);
    });

    // label : Get A Single Car
    app.get("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carCollection.findOne(query);
      res.send(result);
    });

    // label : Get User Added Car
    app.get("/mycars/:email", async (req, res) => {
      const email = req.params.email;
      const query = { addedBy: email };
      const result = await carCollection.find(query).toArray();
      res.send(result);
    });

    // label : Add A Car
    app.post("/cars", async (req, res) => {
      const car = req.body;
      const result = await carCollection.insertOne(car);
      res.send(result);
    });

    // label : Update A Car
    app.patch("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const updatedCar = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedCar,
      };
      const result = await carCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // label : Bookings Routes
    // label : Get All Bookings
    app.get("/bookings", async (req, res) => {
      const bookings = bookingsCollection.find();
      const result = await bookings.toArray();
      res.send(result);
    });

    // label : Book A Car
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);

      // label : Update Booking Count
      const updateDoc = {
        $inc: { rent_count: 1 },
      };
      const filter = { _id: new ObjectId(booking.carID) };
      await carCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the driveXpress server!");
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
