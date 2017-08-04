/**
 *  auto download   instagram data.
 */
var path=require('path');
var cheerio=require('cheerio');
var request=require('request');
var fs=require('fs')

var events = require('events');
var event_img_video= new events.EventEmitter();

var querystring=require('querystring');
var config=require('./config.js');
var domain='https://www.instagram.com';
var directory=user=process.argv[2]; //目录
var catch_url=`${domain}/${process.argv[2]}/`;
var query=config[user];
console.log('query: ',query);

if(!query){
    console.log('该用户不存在配置!');
    return false;
}
var end_cursor=query.variables.after;
/*var http_req = request.defaults({'proxy':'http://127.0.0.1:8087'})
var options = {
    url: catch_url,
    cert: fs.readFileSync('CA.crt'),
    ca: fs.readFileSync('CA.crt')
}, options_catch = {
    url: catch_url,
    cert: fs.readFileSync('CA.crt'),
    ca: fs.readFileSync('CA.crt')
};
*/
var http_req = request.defaults()
var options = {
    url: catch_url
}, options_catch = {
    url: catch_url
};
var total=0;
var statu=fs.existsSync(path.join(__dirname,directory));
if (!statu) {
        fs.mkdirSync(path.join(__dirname,directory));
        console.log('目录创建成功\n');
}else{
    console.log('目录已存在......');
    //process.exit();
}

function startCatchImages(url){
    options_catch.url=catch_url;
    http_req(options_catch, function (error, req,body) {
        console.log('>>>>>>>>err:>>>>>:',error);
        var html=body;
        var $ = cheerio.load(html);  
        fs.writeFileSync('html.txt',html);
        var chapters = $('._jjzlb img');
        var chapters_video = $('._nljxa ._qihym');
        var imgurl_text='',imageurls=[],videourls=[];
        console.log('image count: ',chapters.length);
        console.log('video count: ',chapters_video.length);
        for(var i=0;i<chapters_video.length;i++){
           videourls.push((domain+chapters_video[i].parent.attribs.href+'?taken-by='+user));
        }
        for(let i=0;i<chapters.length;i++){
            imageurls.push((chapters[i].attribs.src));
        }
        if(chapters_video.length){
            event_img_video.emit('videoDownload',videourls)
        }
        if(chapters.length){
            event_img_video.emit('imageDownload',imageurls)
        }
    })
}

event_img_video.on('imageDownload',function(urls,page){
      var i=0;
      console.log('has  ',urls.length+' imgs need download');
     var timer=setInterval(function(){
        if(i<urls.length){
            let img_url_arr=urls[i].split('/');
            let file= img_url_arr[img_url_arr.length-1];
            options.url=urls[i];
            console.log('find image:',i,options.url);
            var statu=fs.existsSync(path.join(directory,file));
            !statu&&http_req(options).pipe(fs.createWriteStream(path.join(directory,file)));  //save image
            i++;
        }else{ 
            console.log('current page '+page+' download [image] OK');
            total++;
            event_img_video.emit('finished');
            clearInterval(timer);
        }
    },3000);
})

event_img_video.on('videoDownload',function(urls,page){
        var i=0;
      var timer=setInterval(function(){
        if(i<urls.length){
            downloadVideo(urls[i]);
            i++;
        }else{
            console.log('current page '+page+' download [video] OK');
            total++;
            clearInterval(timer);
        }
    },4000);
})



event_img_video.on('finished',function(){
        event_img_video.emit('next');
  
});


event_img_video.on('next',function(){
    setTimeout(function(){
        next_request();
    },100)
   
})

 
function downloadVideo(page_url){
    options_catch.url=page_url
     http_req(options_catch, function (error, req,body) {
        console.log('>>>>>>>>video err:>>>>>:',error);
        var html=body;
        var $ = cheerio.load(html);  
        var chapters = $('head meta');
        var video_url=''
        
        for(let i=0;i<chapters.length;i++){
            let k=chapters[i].attribs["property"];
            if(k=="og:video"){
                video_url=chapters[i].attribs.content;
            }
        }
        console.log('find  video count: ',video_url);
        if(!video_url.length){
            return ;
        }
        setTimeout(function() {
            options.url=video_url;
            let videos_url_arr=video_url.split('/');
            let file= videos_url_arr[videos_url_arr.length-1];
             var statu=fs.existsSync(path.join(directory,file));
            !statu&&http_req(options).pipe(fs.createWriteStream(path.join(directory,file)));  //save video
        }, 1500);
    })
}

 var page=1;
function next_request(){
    console.log('start request next page..................',page);
    query.variables.after=end_cursor;
    var queryObj=querystring.stringify({query_id:query.query_id})+'&variables='+JSON.stringify(query.variables)
    options_catch.url='https://www.instagram.com/graphql/query/?'+queryObj;
    if(!end_cursor){
       console.log('all data catch finished.............................');
    }
    end_cursor&&http_req(options_catch, function (error, req,body) {
            console.log('>>>>>>>>err:>>>>>:',error);
            page++;
            let data={data:{edge_owner_to_timeline_media:{edges:[],page_info:{}}}}
            try{
                 data=JSON.parse(body);
               
            }catch(ex){
                 data={data:{user:{edge_owner_to_timeline_media:{edges:[],page_info:{}}}}}
                console.log(ex);
            }
            let info=data.data.user.edge_owner_to_timeline_media;
            let imgs=info.edges.map(img=>{ return img.node.display_url;});
            let videos=info.edges.filter(img=>{
                return img.node.is_video==true;
            }).map(img=>{
                let video= img.node.is_video?(domain+'/p/'+img.node.shortcode+'/?taken-by='+user):"";
                console.log(video);
                return video;
            })
            console.log('imgs :',imgs.length,'videos :',videos.length,videos)
            let page_info=info.page_info;
            end_cursor= page_info.has_next_page?page_info.end_cursor:null;
            if(imgs.length){
                event_img_video.emit('imageDownload',imgs,page);
            }
            if(videos.length){
                event_img_video.emit('videoDownload',videos,page);
            }
            console.log(page_info);
    });
}
next_request();



