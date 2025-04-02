require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://drivexpress-himadree.web.app/",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};

// label : Middleware
app.use(cors(corsOptions));
app.use(express.json());

// label : JWT Token Verification Middleware

// label : MongoDB Connection
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

    // label : JWT Token Generate
    // app.post("jwt", async (req, res) => {
    //     const email = req.body;
    //     const to
    // })

    // label : Cars Routes
    // label : Get All Cars
    // In the cars routes section, replace the existing /cars endpoint with this:

    // label : Get All Cars with pagination, search, and sorting
    app.get("/cars", async (req, res) => {
      try {
        const { page = 1, limit = 3, sort = "newest", search = "" } = req.query;

        // Build query for search
        const query = {};
        if (search.trim()) {
          query.$or = [
            { name: { $regex: search, $options: "i" } },
            { type: { $regex: search, $options: "i" } },
            { location: { $regex: search, $options: "i" } },
          ];
        }

        // Build sort options
        let sortOption = {};
        switch (sort) {
          case "newest":
            sortOption = { dateAdded: -1 };
            break;
          case "oldest":
            sortOption = { dateAdded: 1 };
            break;
          case "price-low":
            sortOption = { price: 1 };
            break;
          case "price-high":
            sortOption = { price: -1 };
            break;
          default:
            sortOption = { dateAdded: -1 };
        }

        // Calculate pagination
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        // Get total count for pagination
        const totalCount = await carCollection.countDocuments(query);

        // Get paginated results
        const cars = await carCollection
          .find(query)
          .sort(sortOption)
          .skip(skip)
          .limit(limitNumber)
          .toArray();

        res.send({
          success: true,
          cars,
          totalCount,
          totalPages: Math.ceil(totalCount / limitNumber),
          currentPage: pageNumber,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error,
        });
      }
    });

    // Keep all your other existing routes as they are

    // label : Get Recent Added Cars
    app.get("/recentcars", async (req, res) => {
      const cars = carCollection.find().sort({ dateAdded: -1 }).limit(8);
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

    // label : Get User Specific Added Car
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

    // label : Delete A Car
    app.delete("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carCollection.deleteOne(query);
      res.send(result);
    });

    // label : Bookings Routes
    // label : Get All Bookings
    app.get("/bookings", async (req, res) => {
      const bookings = bookingsCollection.find();
      const result = await bookings.toArray();
      res.send(result);
    });

    // label : Get User Specific Booked Car
    app.get("/bookings/:email", async (req, res) => {
      const email = req.params.email;
      const query = { bookedBy: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    // label : Get User Specific Booked Car
    app.get("/requests/:email", async (req, res) => {
      const email = req.params.email;
      const query = { addedBy: email };
      const result = await bookingsCollection.find(query).toArray();
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

    // label : Update Booking Count Status
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const updatedBooking = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedBooking,
      };
      const result = await bookingsCollection.updateOne(filter, updateDoc);
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
