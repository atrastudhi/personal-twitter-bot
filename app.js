const Twit = require('twit')
const Nistagram = require('nistagram');
const fs = require('fs');
const axios = require('axios');
const toBase64 = require('base64-arraybuffer');
const dotenv = require('dotenv');

dotenv.config()

const ig = new Nistagram.default();

setInterval(async () => {
  try {
    let session = await ig.login(process.env.USERNAME, process.env.PASS);
    let x = await ig.getTimeLineFeed();
    let obj = await fetch();
    
    for (let i = x.length - 1; i >= 0 ; i--) {
      if (!obj.id.includes(x[i].node.id)) {
        if (x[i].node.__typename === 'GraphImage') {

          let { data } = await axios.get(x[i].node.display_url, {
            responseType: 'arraybuffer'
          })

          let base64 = toBase64.encode(data);
          
          let ids = await uploadImage(base64);
          let tweet = `[${x[i].node.taken_at_timestamp}] ${x[i].node.owner.username} on instagram:`
    
          await twitingImage(tweet, ids);
          console.log(`tweete: ${tweet}`);

          //save to json
          obj.id.push(x[i].node.id);
          
        } else if (x[i].node.__typename === 'GraphSidecar') {
          let sidecar = x[i].node.edge_sidecar_to_children.edges;
          let timestamp = x[i].node.taken_at_timestamp;
          let username = x[i].node.owner.username;
          let master_id;

          for (let j = 0; j < sidecar.length; j++) {
            if (!master_id) {
              let { data } = await axios.get(sidecar[j].node.display_url, {
                responseType: 'arraybuffer'
              })
    
              let base64 = toBase64.encode(data);
  
              let ids = await uploadImage(base64);
              let tweet = `[${timestamp}] ${username} on instagram [${j + 1}]:`
  
              let { id_str } = await twitingImage(tweet, ids);
              console.log(`tweete: ${tweet}`);
  
              master_id = id_str;
            } else {
              let { data } = await axios.get(sidecar[j].node.display_url, {
                responseType: 'arraybuffer'
              })
    
              let base64 = toBase64.encode(data);
  
              let ids = await uploadImage(base64);
              let tweet = `[${timestamp}] ${username} on instagram [${j + 1}]:`
  
              let { id_str } = await reply(tweet, ids, master_id);
              console.log(`tweete: ${tweet}`);
  
              master_id = id_str;
            }
          }

          //save to json
          obj.id.push(x[i].node.id);
        }
      }
    }

    await save(obj);
    console.log('saved to db')
  } catch (err) {
    console.error(err)
  }
}, 60000)

var T = new Twit({
  consumer_key:         process.env.CONSUMER_KEY,
  consumer_secret:      process.env.CONSUMER_SECRET,
  access_token:         process.env.ACCESS_TOKEN,
  access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
  strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

let uploadImage = (base64) => {
  return new Promise((resolve, reject) => {
    T.post('media/upload', { media_data: base64 }, (err, data, response) => {
      if (err) return reject(err)
      else return resolve(data.media_id_string)
    })
  })
}

let twitingImage = (tweet, ids) => {
  return new Promise((resolve, reject) => {
    T.post('statuses/update', { status: tweet, media_ids: ids }, function(err, data, response) {
      if (err) return reject(err)
      else return resolve(data)
    })
  })
}

let fetch = () => {
  return new Promise((resolve, reject) => {
    fs.readFile('db.json', 'utf8', (err, data) => {
      if (err) reject(err)
      else resolve(JSON.parse(data))
    })
  })
}

let save = (obj) => {
  return new Promise((resolve, reject) => {
    fs.writeFile('db.json', JSON.stringify(obj), (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

let reply = (tweet, ids, id) => {
  return new Promise((resolve, reject) => {
    T.post('statuses/update', { status: tweet, media_ids: ids, in_reply_to_status_id: id, in_reply_to_status_id: id }, function(err, data, response) {
      if (err) return reject(err)
      else return resolve(data)
    })
  })
}
