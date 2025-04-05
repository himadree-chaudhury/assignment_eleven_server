require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000;

// *CORS Configuration
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://drivexpress-himadree.web.app",
  ],
  credentials: true,
  optionalSuccessStatus: 200,
};

// *Middleware Setup
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// *JWT Token Verification Middleware
const verifyJWTToken = (req, res, next) => {
  const token = req.cookies?.driveXpressAccess;
  if (!token) {
    return res.status(401).send({ massage: "Unauthorize Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      console.log(error);
      return res.status(400).send({ massage: "Bad Request" });
    }
    req.user = decoded;
    next();
  });
};

// *MongoDB Connection URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.lhej2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// *MongoDB Client Setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // *Database And Collections
    const database = client.db(process.env.DB_NAME);
    const carCollection = database.collection("cars");
    const bookingsCollection = database.collection("bookings");

    // *Generate JWT Token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5d",
      });
      res
        .cookie("driveXpressAccess", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // *Clear Cookie On Logout
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("driveXpressAccess", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // *Get All Cars With Pagination, Search, And Sorting
    app.get("/cars", async (req, res) => {
      const page = req.query.page;
      const limit = req.query.limit;
      const search = req.query.search;
      const sort = req.query.sort;

      // *Query For Search
      const query = {};
      if (search.trim()) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { type: { $regex: search, $options: "i" } },
          { location: { $regex: search, $options: "i" } },
        ];
      }

      // *Sorting Options
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

      // *Pagination Calculation
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      const totalCount = await carCollection.countDocuments(query);

      // *Fetch Results
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
    });

    // *Get Recently Added Cars
    app.get("/recentcars", async (req, res) => {
      const cars = carCollection.find().sort({ dateAdded: -1 }).limit(8);
      const result = await cars.toArray();
      res.send(result);
    });

    // *Get A Single Car By ID
    app.get("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carCollection.findOne(query);
      res.send(result);
    });

    // *Get User-Specific Added Cars
    app.get("/mycars/:email", verifyJWTToken, async (req, res) => {
      const decodedEmail = req.user.email;
      const email = req.params.email;

      // *Verify User
      if (decodedEmail !== email) {
        return res.status(403).send({ massage: "Forbidden Access" });
      }

      const page = req.query.page;
      const limit = req.query.limit;
      const sort = req.query.sort;
      const query = { addedBy: email };

      // *Sort Options
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

      // *Pagination Calculation
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      const totalCount = await carCollection.countDocuments(query);

      // *Fetch Results
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
    });

    // *Add A Car
    app.post("/cars", async (req, res) => {
      const car = req.body;
      const result = await carCollection.insertOne(car);
      res.send(result);
    });

    // *Update A Car
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

    // *Delete A Car
    app.delete("/cars/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await carCollection.deleteOne(query);
      res.send(result);
    });

    // *Get User-Specific Booked Cars
    app.get("/bookings/:email", verifyJWTToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user.email;

      // *Verify User
      if (decodedEmail !== email) {
        return res.status(403).send({ massage: "Forbidden Access" });
      }

      const page = req.query.page;
      const limit = req.query.limit;
      const sort = req.query.sort;
      const query = { bookedBy: email };

      // *Sort Options
      let sortOption = {};
      switch (sort) {
        case "newest":
          sortOption = { dateBooked: -1 };
          break;
        case "oldest":
          sortOption = { dateBooked: 1 };
          break;
        case "price-low":
          sortOption = { totalPrice: 1 };
          break;
        case "price-high":
          sortOption = { totalPrice: -1 };
          break;
        default:
          sortOption = { dateBooked: -1 };
      }

      // *Pagination Calculation
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      const totalCount = await bookingsCollection.countDocuments(query);

      // *Fetch Results
      const bookings = await bookingsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNumber)
        .toArray();

      res.send({
        success: true,
        bookings,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNumber),
        currentPage: pageNumber,
      });
    });

    // *Get User-Specific Car Requests
    app.get("/requests/:email", verifyJWTToken, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.user.email;

      // *Verify User
      if (decodedEmail !== email) {
        return res.status(403).send({ massage: "Forbidden Access" });
      }

      const page = req.query.page;
      const limit = req.query.limit;
      const sort = req.query.sort;
      const query = { addedBy: email };

      // *Sort Options
      let sortOption = {};
      switch (sort) {
        case "newest":
          sortOption = { dateBooked: -1 };
          break;
        case "oldest":
          sortOption = { dateBooked: 1 };
          break;
        case "price-low":
          sortOption = { totalPrice: 1 };
          break;
        case "price-high":
          sortOption = { totalPrice: -1 };
          break;
        default:
          sortOption = { dateBooked: -1 };
      }

      // *Pagination Calculation
      const pageNumber = parseInt(page);
      const limitNumber = parseInt(limit);
      const skip = (pageNumber - 1) * limitNumber;
      const totalCount = await bookingsCollection.countDocuments(query);

      // *Fetch Results
      const requests = await bookingsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limitNumber)
        .toArray();
      res.send({
        success: true,
        requests,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNumber),
        currentPage: pageNumber,
      });
    });

    // *Book A Car
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);

      // *Update Booking Count
      const updateDoc = {
        $inc: { rent_count: 1 },
      };
      const filter = { _id: new ObjectId(booking.carID) };
      await carCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // *Update Booking Status
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
    // Ensure Client Closes After Operations
    // await client.close();
  }
}

run().catch(console.dir);

// *Root Route
app.get("/", (req, res) => {
  res.send("Welcome To The DriveXpress Server!");
});

// *Start Server
app.listen(PORT, () => {
  console.log(`Server Is Running On Port ${PORT}`);
});
