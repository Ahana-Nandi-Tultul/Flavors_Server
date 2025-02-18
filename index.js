const express = require('express');
const app = express();
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
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
  const verifyJwt = (req, res, next) => {
    const authorization = req.headers.authorization;
    if(!authorization){
      return res.status(401).send({error: {status: true, message: 'unauthorized access'}});
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decode) => {
      if(error){
        return res.status(401).send({error: {status: true, message: 'unauthorized access'}});
      }
      req.decode = decode;
      next();
    })
  }
  app.post('/jwt', (req, res) => {
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'})
    res.send({token})
})

async function run() {
    try { 
        const itemCollections = client.db('flavors').collection('items');
        const userCollections = client.db('flavors').collection('users');

        app.get('/allItems', async(req, res) => {
            const result = await itemCollections.find().toArray();
            res.send(result);
        })

        app.get('/totalItems', async(req, res) => {
          const result = await itemCollections.estimatedDocumentCount();
          res.send({totalItems: result})
        });

        app.get('/itemsPerPage', async(req, res) => {
          const page = parseInt(req.query.page) || 0;
          const limit = parseInt(req.query.limit) || 0;
          const skip = page * limit;
          const result = await itemCollections.find().skip(skip).limit(limit).toArray();
          res.send(result)
        });

        app.get('/items', async(req, res) => {
          const search = req?.query?.search;
          let query = {};
          if(search){
            query = {name : {$regex : search, $options: 'i'}}
          }
          
          const result = await itemCollections.find(query).toArray();
          res.send(result);
        })

        app.post('/users', async(req, res) => {
          const newUser = req.body;
          const email = newUser?.email;
          const filter = {email: email};
          const existUser = await userCollections.findOne(filter);
          if(existUser){
            return res.send({});
          }
          const result = await userCollections.insertOne(newUser);
          res.send(result);
      });

      app.get('/users/:email', verifyJwt, async(req, res) => {
        const email = req.params.email;
        console.log(email);
        if(email !== req.decode.email){
          return res.status(403).send({error: {status: true, message: 'forbidden access'}});
        }
  
        const query = {email: req.decode.email};
        const result = await userCollections.findOne(query);
  
        if(!result){
          return res.status(401).send({error: {status: true, message: 'unauthorized access'}});
        }
        if(result.role == 'Customer'){
          return  res.send({isCustomer: true});
        }
        else if(result.role == 'Admin'){
          return  res.send({isAdmin : true});
        }
        else{
          return res.status(401).send({error: {status: true, message: 'unauthorized access'}});
        }
  
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