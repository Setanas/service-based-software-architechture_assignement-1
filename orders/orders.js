const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const axios = require("axios");
const config = require('../config.json');

require("./Order");
const Order = mongoose.model("Order");

app.use(bodyParser.json());

mongoose.connect(
  "mongodb+srv://MarcD:UDoYX5HUundpJXtm@cluster0-2cdlr.mongodb.net/orders?retryWrites=true&w=majority", { useNewUrlParser: true, useUnifiedTopology: true },
  () => {
    console.log("db connected");
  }
);

app.get("/", (req, res) => {
  res.send("main endpoint");
});

function postTicket(req, res, ticket) {
  if (ticket.data.stock == 0) {
    res.status(403).send("No more ticket available");
  } else {
    var newOrder = {
      userId: req.body.userId,
      ticketId: req.body.ticketId,
      paid: false
    };
    var order = new Order(newOrder);

    order.save()
      .then(() => {
        res.send("new order created");
      })
      .catch((err) => {
        if (err) {
          res.status(403).send("Could not save new order");
          throw err;
        }
      });
  }
}

app.post("/order", (req, res) => {
  axios.get("http://localhost:" + config.ticketPort + "/ticket/" + req.body.ticketId)
    .then(postTicket.bind(null, req, res))
    .catch((err) => {
      if (err) {
        res.status(403).send("Could not get ticket");
        throw err;
      }
    });
});


function payTicket(document, res, userData, ticket) {
  if (userData.wallet >= ticket.data.price &&
    ticket.data.stock > 0 &&
    document.paid == false) {
    document.paid = true;
    axios.patch("http://localhost:" + config.ticketPort + "/ticket/" + document.ticketId)
    .catch((err) => {
      if (err) {
        res.status(403).send("Could not patch ticket");
        throw err;
      }
    });
    axios.patch("http://localhost:" + config.userPort + "/user/" + document.userId, {price: ticket.data.price})
    .catch((err) => {
      if (err) {
        res.status(403).send("Could not patch user");
        throw err;
      }
    });
    document.save()
    res.send("The order has been paid")
  } else {
    res.sendStatus(404)
  }
}

function getUser(document, res, user) {
  if (user) {
    axios.get("http://localhost:" + config.ticketPort + "/ticket/" + document.ticketId)
      .then(payTicket.bind(null, document, res, user.data))
      .catch(err => {
        if (err) {
          res.status(403).send("Could not get ticket");
          throw err;
        }
      });
  } else {
    res.status(403).send("Could not get user");
  }
}

app.patch("/order/:id", (req, res) => {
  Order.findById(req.params.id).then((document) => {
    if (document) {
      axios.get("http://localhost:" + config.userPort + "/user/" + document.userId)
        .then(getUser.bind(null, document, res))
        .catch((err) => {
          if (err) {
            res.status(403).send("Could not get user");
            throw err;
          }
        });
    } else {
      res.status(403).send("Could not get order");
    }
  }).catch((err) => {
    if (err) {
      res.status(403).send("Could not get order");
      throw err;
    }
  });
})


app.get("/orders", (req, res) => {
  Order.find()
    .then((orders) => {
      res.json(orders);
    })
    .catch((err) => {
      if (err) {
        res.status(403).send("Could not get orders");
        throw err;
      }
    });
});

app.get("/order/:id", (req, res) => {
  Order.findById(req.params.id)
    .then((order) => {
      if (order) {
        axios.get("http://localhost:" + config.userPort + "/user/" + order.userId).then((response) => {
          var orderObject = { userId: order.userId, userName: response.data.name, userWallet: response.data.wallet, ticketId: order.ticketId, ticketName: "", ticketPrice: "", ticketStock: "", paid: order.paid }
          axios.get("http://localhost:" + config.ticketPort + "/ticket/" + order.ticketId).then((response) => {
            orderObject.ticketName = response.data.name
            orderObject.ticketPrice = response.data.price
            orderObject.ticketStock = response.data.stock
            res.json(orderObject);
          })
        })
      } else {
        res.status(403).send("Could not get order");
      }
    })
    .catch((err) => {
      if (err) {
        res.status(403).send("Could not get order");
        throw err;
      }
    });
});

app.delete("/order/:id", (req, res) => {
  Order.findByIdAndRemove(req.params.id)
    .then(() => {
      res.send("Order deleted");
    })
    .catch((err) => {
      if (err) {
        res.status(403).send("Could not delete order");
        throw err;
      }
    });
});

app.listen(Number(config.orderPort), () => {
  console.log("server for Orders running");
});

//5e9f38f300cbd7a6f397683c
//5e9f36ee0483f4a5071812eb