const express = require('express');
const app = express();
var jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_SECRET);
//console.log(process.env.PAYMENT_GATEWAY_SECRET);
const port = process.env.PORT || 5000;

const cors = require('cors');

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });
  
  const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.epxwefd.mongodb.net/myDatabase?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
      tls: true,
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
        const cartCollections = client.db('flavors').collection('carts');
        const paymentCollections = client.db('flavors').collection('payments');

        const verifyAdmin = async(req, res, next) =>{
          const email = req.decode.email;
          const query = {email: email};
          const result = await userCollections.findOne(query);
          if(result.role === 'Admin'){
            next();
          }
        };
        
        app.get('/allItems', async (req, res) => {
          try {
              const result = await itemCollections.find({ quantity: { $gt: 0 } }).toArray();
              res.send(result);
          } catch (error) {
              console.error("Error fetching items:", error);
              res.status(500).send({ error: "Internal Server Error" });
          }
      });
      
        app.get('/adminAllItems/:email', verifyJwt, verifyAdmin, async(req, res) => {
            const result = await itemCollections.find().toArray();
            res.send(result);
        })

        app.patch('/updateProduct/:id', verifyJwt, verifyAdmin, async(req, res) => {
          const itemId = req.params.id;
          const filter = {_id: new ObjectId(itemId)};
          const updateInfo = req.body.updateInfo;
          const newUpdateInfo = {
            $set : {
              name: updateInfo?.name,
              price : updateInfo?.price,
              quantity : updateInfo?.quantity
            }
          }
          const result = await itemCollections.updateOne(filter, newUpdateInfo)
          res.send(result);
        });

        app.delete('/product/:id', verifyJwt, verifyAdmin, async(req, res) => {
          const id = req.params.id;
          const query = {_id: new ObjectId(id)};
          const result = await itemCollections.deleteOne(query);
          res.send(result);
        });

        app.post('/item', verifyJwt, verifyAdmin, async(req, res) => {
          const newItem = req.body.newItem;
          // console.log(newClass);
          const result = await itemCollections.insertOne(newItem);
          res.send(result);
        });

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

        app.get('/users',verifyJwt, verifyAdmin, async(req, res) => {
          const result = await userCollections.find().toArray();
          res.send(result);
        });
    
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
        //console.log(email);
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
      app.patch('/users/:id', verifyJwt, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const role = req.body;
        const filter = {_id: new ObjectId(id)};
        const newRole = {
          $set: role
        }
        const result = await userCollections.updateOne(filter, newRole);
        res.send(result);
      });

      app.delete('/users/:id', verifyJwt, verifyAdmin, async(req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await userCollections.deleteOne(query);
        res.send(result);
      });

      app.get('/carts/:email', verifyJwt, async(req, res) => {
        const email = req.params.email;
        //console.log(email);
        const filter = { userEmail: email };
        const result = await cartCollections.find(filter).toArray();
        //console.log(result, filter);
        res.send(result);
      });
  
      app.post('/carts', verifyJwt, async (req, res) => {
        const { userCart } = req.body; 
        // console.log(userCart);
        if (!userCart || !Array.isArray(userCart) || userCart.length === 0) {
            return res.status(400).send({ message: "Invalid cart data" });
        }
    
        try {
            const result = await cartCollections.insertMany(userCart); 
            res.send(result);
        } catch (error) {
            console.error("Error inserting cart data:", error);
            res.status(500).send({ message: "Failed to insert cart items" });
        }
    });
    
    
  
      app.delete('/carts/:id', verifyJwt, async(req, res) => {
        const id = req.params.id;
        const filter = {_id: new ObjectId(id)};
        const result = await cartCollections.deleteOne(filter);
        res.send(result);
      })

      app.post('/create-payment-intent', verifyJwt, async(req, res) => {
        const {price} = req.body;
        const amount = parseInt(price * 100);
        const payment = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ["card"],
        });
        console.log({
          clientSecret : payment.client_secret
        });
        res.send({
          clientSecret : payment.client_secret
        })
      });

      app.post('/payments', verifyJwt, async (req, res) => {
        const payment = req.body;
        console.log(`payment: ${payment}`)
        try {  
            const insertResult = await paymentCollections.insertOne(payment);
            //console.log(insertResult);
            for (const product of payment.productId) {
                //console.log(product);
                const productId = product.id; 
                const buyQuantity = product.quantity; 
    
                const updateResult = await itemCollections.updateOne(
                    { _id: new ObjectId(productId), quantity: { $gt: 0 } }, 
                    { $inc: { quantity: -buyQuantity } } 
                );
    
                console.log(`Updated product ${productId}:`, updateResult);
            }
    
            const query = {
                _id: { $in: payment.cartItems.map(id => new ObjectId(id)) }
            };
            const deleteResult = await cartCollections.deleteMany(query);
    
            res.send({ success: true, insertResult, deleteResult });
        } catch (error) {
            console.error("Error processing payment:", error);
            res.status(500).send({ success: false, message: "Internal server error" });
        }
    });
    

      app.get('/payments/history/:email', verifyJwt, async(req, res) => {
        const email = req.params.email;
        const query = {
          email: email
        }
        const result = await paymentCollections.find(query).sort({date : -1 }).toArray();
        res.send(result);
      });

      app.get('/allOrders', verifyJwt, verifyAdmin, async(req, res) => {
        const result = await paymentCollections.find().toArray();
        res.send(result);
      });

      app.patch('/allOrders/:id', verifyJwt, verifyAdmin, async(req, res) => {
        const productid = req.params.id;
        const filter = {_id: new ObjectId(productid)};
        const status = req.body.status;
        const newStatus = {
          $set: {status}
        };
        const result = await paymentCollections.updateOne(filter, newStatus);
        res.send(result);
      });
       
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