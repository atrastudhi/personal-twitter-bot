const Twit = require('twit')
const Nistagram = require('nistagram');
const fs = require('fs');
const axios = require('axios');
const toBase64 = require('base64-arraybuffer');
const dotenv = require('dotenv');

dotenv.config()

let ig = new Nistagram.default();

let main = async () => {
  try {
    console.log('============================= start ==================================')
    let session = await fetch('user.json');
    ig = new Nistagram.default(session);

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
    console.log('============================= end ==================================')
  } catch (err) {
    console.error(err)
  }
}

let kue_check = false

let story = async () => {
  try {
    if (!kue_check) {
      kue_check = true;
      console.log('================================== start story ==================================')
      let session = await fetch('user.json');
      ig = new Nistagram.default(session);

      let db = await fetch('story.json');
    
      let username = ['jkt48rachel', 'jkt48.vivi', 'jkt48.jessi', 'jkt48.chika', 'jkt48.febi', 'jkt48.ratu']
    
      for (let i = 0; i < username.length; i++) {
        let x = await ig.getStory(username[i])
    
        if (x) {
          for (let j = 0; j < x.length; j++) {
            if (!db.list.includes(x[j].reelMediaId)) {
              let { data } = await axios.get(x[j].media, {
                responseType: 'arraybuffer'
              })
      
              let path = await tempSave(data, x[j].media);
      
              let media_id_str = await chunkedMedia(path);
              let tweet = `[${x[j].reelMediaId}] ${username[i]} instagram story:`;
      
              await twitingImage(tweet, media_id_str);
              console.log(`tweet send: ${tweet}`);
      
              let unlink = await deleteTemp(path);
              console.log(unlink);

              db.list.push(x[j].reelMediaId);
            }
          }
        }
      }

      await save(db, 'story.json');
      console.log('saved story.json')
      console.log('================================== end story ==================================')
      kue_check = false;
    }
  } catch (err) {
    console.error(err)
  }
}

var T = new Twit({
  consumer_key:         process.env.CONSUMER_KEY,
  consumer_secret:      process.env.CONSUMER_SECRET,
  access_token:         process.env.ACCESS_TOKEN,
  access_token_secret:  process.env.ACCESS_TOKEN_SECRET,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
  strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

let deleteTemp = (path) => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err, data) => {
      if (err) reject(err)
      else resolve(`success unlink: ${path}`)
    })
  })
}

let chunkedMedia = (path) => {
  return new Promise((resolve, reject) => {
    T.postMediaChunked({ file_path: path }, function (err, data, response) {
      if (err) reject(err)
      else {
        setTimeout(async () => {
          resolve(data.media_id_string)
        }, 3000)
      }
    })
  })
}

let tempSave = (buff, link) => {
  return new Promise((resolve, reject) => {
    let type = link.includes('.mp4') ? '.mp4' : '.jpg';
    fs.writeFile(`./tmp/tmp${type}`, buff,(err, data) => {
      if (err) reject(err)
      else resolve(`./tmp/tmp${type}`)
    })
  })
}

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


let save = (obj, path='db.json') => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, JSON.stringify(obj), (err, data) => {
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

let fetch = (file='db.json') => {
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', (err, data) => {
      if (err) reject(err)
      else resolve(JSON.parse(data))
    })
  })
}

setInterval(() => {
  story();
}, 5000)

setInterval(() => {
  main();
}, 10000)

setInterval(async () => {
  console.log('================== start weekly login session =======================')
  await ig.login(process.env.USERNAME, process.env.PASS);
  console.log('================== end weekly login session =======================')
}, 1000*60*60*24*7)
