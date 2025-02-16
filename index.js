const express = require('express');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://toybox-97639.web.app');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });
  
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.epxwefd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
  
async function run() {
    try { 
        const itemCollections = client.db('flavors').collection('items');
        app.get('/allItems', async(req, res) => {
            const result = await itemCollections.find().toArray();
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

      } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
      }
    }
    run().catch(console.dir);

app.get('/', (req, res)=>{
    res.send("Flavors is now in online");
})
app.get('/allItems', (req, res) => {

})
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});