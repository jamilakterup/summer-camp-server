const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// verify jwt
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({error: true, message: 'unauthorized access'})
    }

    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({error: true, message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
    })
}




const uri = 'mongodb://0.0.0.0:27017'

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.n1furk6.mongodb.net/?retryWrites=true&w=majority`;


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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const menuCollection = client.db("summerDb").collection("menu");
        const cartCollection = client.db("summerDb").collection("cart");
        const usersCollection = client.db("summerDb").collection("users");



        // jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
            res.send({token});
        })


        // verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(401).send({error: true, message: 'forbidden access'});
            }
            next();
        }
        // verify instructor
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(401).send({error: true, message: 'forbidden access'});
            }
            next();
        }


        // all users related apis

        // TODO---ADD VERIFY JWT token VERIFY ISADMIN----------
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = {email: user.email}
            const existingUsers = await usersCollection.findOne(query);
            if (existingUsers) {
                return res.send({message: "users already exist"})
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })


        app.get('/users/role/:email', async (req, res) => {
            const email = req.params.email;
            const query = {email: email}
            const user = await usersCollection.findOne(query);
            if (user?.role === 'admin') {
                res.send('admin')
            } else if (user?.role === 'instructor') {
                res.send('instructor')
            } else {
                res.send('student')
            }
        })



        app.patch('/users/role/:id', async (req, res) => {
            const id = req.params.id;
            const role = req.body.role;
            const query = {_id: new ObjectId(id)}
            const updateDoc = {
                $set: {
                    role: role
                }
            }
            const result = await usersCollection.updateOne(query, updateDoc)
            res.send(result);
        })

        // all menu items
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        app.get('/menu/:email', verifyJWT, verifyInstructor, async (req, res) => {
            const email = req.params.email;
            const query = {instructorEmail: email}
            const result = await menuCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/menu', verifyJWT, verifyInstructor, async (req, res) => {
            const newItem = req.body;
            const result = await menuCollection.insertOne(newItem);
            res.send(result);
        })


        // cart collection
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });


        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(401).send({error: true, message: 'forbidden access token'})
            };

            const query = {email: email}
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });



        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ping: 1});
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('welcome to summer camp');
})

app.listen(port, () => {
    console.log(`port is running on ${port}`);
})