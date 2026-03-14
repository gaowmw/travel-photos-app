const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const methodOverride = require("method-override");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_FILE = path.join(__dirname, "data.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage per trip
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tripId = req.params.tripId || req.body.tripId;
    const tripDir = path.join(UPLOADS_DIR, tripId || "unassigned");
    if (!fs.existsSync(tripDir)) {
      fs.mkdirSync(tripDir, { recursive: true });
    }
    cb(null, tripDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});

const upload = multer({ storage });

// App config
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOADS_DIR));

// Data helpers
function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { trips: [], photos: [] };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// Routes

// Home: list trips
app.get("/", (req, res) => {
  const data = readData();
  const trips = data.trips.sort(
    (a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0)
  );
  res.render("index", { trips });
});

// New trip form
app.get("/trips/new", (req, res) => {
  res.render("trips_new");
});

// Create trip
app.post("/trips", (req, res) => {
  const { title, description, startDate, endDate, location } = req.body;
  const data = readData();
  const id = uuidv4();
  data.trips.push({
    id,
    title: title || "Untitled trip",
    description: description || "",
    startDate: startDate || null,
    endDate: endDate || null,
    location: location || "",
    createdAt: new Date().toISOString(),
  });
  writeData(data);
  res.redirect(`/trips/${id}`);
});

// Trip detail
app.get("/trips/:id", (req, res) => {
  const data = readData();
  const trip = data.trips.find((t) => t.id === req.params.id);
  if (!trip) {
    return res.status(404).send("Trip not found");
  }
  const photos = data.photos
    .filter((p) => p.tripId === trip.id)
    .sort(
      (a, b) => new Date(a.shotAt || a.createdAt) - new Date(b.shotAt || b.createdAt)
    );
  res.render("trips_show", { trip, photos });
});

// Upload photos to trip
app.post("/trips/:tripId/photos", upload.array("photos", 20), (req, res) => {
  const data = readData();
  const trip = data.trips.find((t) => t.id === req.params.tripId);
  if (!trip) {
    return res.status(404).send("Trip not found");
  }

  const { tags } = req.body;
  const tagsArray =
    typeof tags === "string" && tags.trim().length
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

  const now = new Date().toISOString();

  (req.files || []).forEach((file) => {
    data.photos.push({
      id: uuidv4(),
      tripId: trip.id,
      filename: file.filename,
      relativePath: path.join(trip.id, file.filename).replace(/\\/g, "/"),
      originalName: file.originalname,
      tags: tagsArray,
      shotAt: null,
      createdAt: now,
    });
  });

  writeData(data);
  res.redirect(`/trips/${trip.id}`);
});

// Simple photo delete
app.delete("/photos/:id", (req, res) => {
  const data = readData();
  const photoIndex = data.photos.findIndex((p) => p.id === req.params.id);
  if (photoIndex === -1) {
    return res.status(404).send("Photo not found");
  }

  const photo = data.photos[photoIndex];
  const filePath = path.join(UPLOADS_DIR, photo.relativePath);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  data.photos.splice(photoIndex, 1);
  writeData(data);

  res.redirect("back");
});

// Basic search by tag or location
app.get("/search", (req, res) => {
  const { q } = req.query;
  const query = (q || "").toString().toLowerCase();
  const data = readData();

  const trips = data.trips.filter((t) => {
    return (
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.location && t.location.toLowerCase().includes(query))
    );
  });

  const photos = data.photos.filter((p) => {
    const tags = (p.tags || []).join(" ").toLowerCase();
    const original = (p.originalName || "").toLowerCase();
    return (
      tags.includes(query) ||
      original.includes(query)
    );
  });

  res.render("search_results", { trips, photos, query });
});

app.listen(PORT, () => {
  console.log(`Travel photos app listening on http://localhost:${PORT}`);
});

