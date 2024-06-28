require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const { hostname } = require('os');
const {URL} = require('url')
const mongoose = require('mongoose')

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.use(express.json())
app.use(express.urlencoded({extended:true}))

// Your first API endpoint
app.get('/api/hello', function(req, res) { 
  res.json({ greeting: 'hello API' });
});

function setConnection(){ 
  mongoose.set('strictQuery',false)
  mongoose.connect(process.env.MONGODB_URL)
}


function agregateUrl(Model, url, short_url){
  const newUrl = new Model({
    original_url: url,
    short_url:short_url
  })
  newUrl.save().then(savedUrl=>{
    console.log('saved url ', savedUrl)
  })
}


const contactSchema = new mongoose.Schema({
  original_url: String,
  short_url: Number,
})
const ShortUrl = mongoose.model('Url', contactSchema) //mongoose convierte Contact a contacts automaticamente como nombre de la coleccion

app.post('/api/shorturl', (req,res)=>{
   
      let url = req.body.url     
      
      if (url.slice(0,8)!=='https://' &&  url.slice(0,7)!=='http://') {    
        //No comienza por hhpts:// o http://
        res.json({
          error:"invalid url"
        })        
      }else{       
         //En caso de que si comience : Pillamos el tipo de protocolo y el resto de URL
        let {protocoloURL, restURL} =url.slice(0,8)==='https://' 
        ? {protocoloURL:'https://', restURL: url.slice(8)} 
        : {protocoloURL:'http://', restURL: url.slice(7)} 
        
        //A continuacion le pasamos la url y la analizamos con dns.lookup
       const options = {
        family: 6,
        hints: dns.ADDRCONFIG | dns.V4MAPPED           
      }
      dns.lookup(restURL,  (err, adress, family) =>{           
        if(err){
          //console.log('errores', err.code , err.hostname)
          res.json({
            error:"Invalid hostname"
          })
        }else{        
         //Si la url es validad ya podemos agregarla a la base de datos: 
          //Conectamos con la base de datos
          setConnection()
          //agregamos la url protocolo incluido          
          let fullURL = `${protocoloURL}${restURL}`
          ShortUrl.findOne({original_url:fullURL}).then(urlFound=>{            
            if(urlFound){             
              res.json({
                original_url: urlFound.original_url,
                short_url: urlFound.short_url
              })
            }else{
              //console.log('no encontrada', urlFound)
              //no se ha encontrado con lo cual agregamos
              if(urlFound===null){          
                ShortUrl.countDocuments().then(count=>{
                  if(count==0){                  
                    //agregamos el primer elemento
                    agregateUrl(ShortUrl,fullURL,1)        
                    res.json({
                      original_url:fullURL,
                      short_url:1
                    })        
                  }else{
                    //Añadimos un elemento 
                    //sacamos el numero de documentos y se lo ponemos como shortUrl
                    agregateUrl(ShortUrl, fullURL, count+1)     
                    res.json({
                      original_url: fullURL, 
                      short_url: count+1
                    }) 
                  }
                })           
              }             
            }
          })  
        }    

      }) 
    }      
  })

app.get('/api/shorturl/:id', (req, res)=>{  
   const id = req.params.id
   //Conectamos con la base de datos   
   setConnection()
   ShortUrl.findOne({short_url:id}).then(urlFound=>{
    if(urlFound){      
     const url = urlFound.original_url           
     res.redirect(url)
    }else{
     res.json({"error":"No short URL found for the given input"})  
   }   
  })
})

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
