const isDevelopmentDrive = window.location.hostname === '833d719039176d2803dcb76576684864953e2550760209b76183054841471fda';

// Constants
const feedID = 'feed';
const feedNewPostID = feedID + 'NewPost';
const acceptedFiles = [
  'follows',
  'ignores',
  'feed',
  'interactions',
  'self',
  'filters',
];
const defaultName = 'Unknown';
const defaultAvatar = "data:image/svg+xml;utf8,<svg width='1em' height='1em' viewBox='0 0 16 16' class='bi bi-person-fill' fill='white' xmlns='http://www.w3.org/2000/svg'><path fill-rule='evenodd' d='M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'/></svg>";
const updateDrive = 'hyper://30d044bc74fe45b5a8c81c4cbeb7081e1ac2f30d9c0c09e0b0d68a07e9c084e6';
const refreshInterval = 60 * 1000;
const markdownConverter = new showdown.Converter();
const rtf = new Intl.RelativeTimeFormat();
const dtf = new Intl.DateTimeFormat();
const dateUnits = {
  year: 24 * 60 * 60 * 1000 * 365,
  month: 24 * 60 * 60 * 1000 * 365/12,
  day: 24 * 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  minute: 60 * 1000,
  second: 1000
}
let refreshFeed = true;
let doRefresh = true;
document.addEventListener('mousemove', () => {if(!doRefresh) doRefresh = true;})

// blah
let store = {
  files: [],
  // Tried to setup a setter. Didn't work
  // I don't like this
  saveFiles: function() {
    return new Promise((resolve, reject) => {
      awaitSave = [];
      acceptedFiles.forEach(file => {
        awaitSave.push(beaker.hyperdrive.writeFile('/store/' + file + '.json', this.files[file], 'json'));
      });
      Promise.all(awaitSave).then(() => resolve());
    });
  },
  loadFiles: function() {
    return new Promise((resolve, reject) => {
      let loadingFiles = [];
      acceptedFiles.forEach(file => {
        loadingFiles.push(beaker.hyperdrive.readFile('/store/' + file + '.json', 'json').then(result => this.files[file] = result));
      });
      Promise.all(loadingFiles).then(() => resolve());
    });
  },
  knowledgeBase: [],
  update: function(crawlDistance = 3) {
    return crawl(crawlDistance).then(() => {
      console.log('Knowledge Base Filled');
    });
  }
}

// Utilities
const arrayFromCSV = CSV => {return CSV.split(',').filter(element => element !== '')};
const locationFromFile = file => {
  if (!acceptedFiles.includes(file)) throw 'Not an accepted file!';
  else {
    return '/store/' + file + '.json'
  }
}
const selfAsFollow = () => {
  return {
    address: location.host,
  };
}

const sortByDate = (a, b) => {
  return a.posted < b.posted ? 1 : -1;
};

const appropriateUnit = difference => {
  for(unit in dateUnits) if(unit === 'second' || Math.abs(difference) > dateUnits[unit]) return unit;
}
const formatDateDifference = date => {
  let difference = date - new Date();
  let unit = appropriateUnit(difference);
  return rtf.format(Math.round(difference / dateUnits[unit]), unit)
}

const newElement = (elementClass, tag, contents = [], attributes = {}, special = ()=>{}) => {
  let element = document.createElement(tag);
  element.classList.add(elementClass);
  if(Array.isArray(contents)) contents.forEach(content => {
    element.appendChild(content);
  });
  else element.innerHTML = contents;
  for(attribute in attributes) {
    element.setAttribute(attribute, attributes[attribute])
  };
  special(element);
  return element;
}

const preventHTMLInContentEditable = (event) => {
   if(event.key === 'Enter') {
    document.execCommand('insertLineBreak');
    event.preventDefault();
  }
}

async function resetFiles() {
  for(var i = 0; i < acceptedFiles.length; i++) {
    let file = acceptedFiles[i];
    let content = file == 'self' ? [{}] : [];
    await beaker.hyperdrive.writeFile(locationFromFile(file), content, 'json');
  }
  location.reload();
}

async function readFromFile(file) {
  let fileLocation = locationFromFile(file);
  var read = await beaker.hyperdrive.readFile(fileLocation, 'json');
  return read;
}

async function appendToFile(file, object) {
  let fileLocation = locationFromFile(file);
  var read = await beaker.hyperdrive.readFile(fileLocation, 'json');
  read.push(object);
  beaker.hyperdrive.writeFile(fileLocation, read, 'json');
}

var crawled;
function crawl(distance, address = location.host, origin = true) {
  return new Promise((resolve, reject) => {
    if(origin) crawled = [];
    crawled.push(address);

    console.log('Crawling ' + address + ' ' + distance + ' steps to go.');

    var waitFor = [];
    store.knowledgeBase[address] = [];
    // TODO: Return as recieved
    acceptedFiles.forEach(file => {
      waitFor.push(new Promise((resolveInner, reject) => {
        try {beaker.hyperdrive.readFile('hyper://' + address + locationFromFile(file), 'json').then(result => {
          //beaker.hyperdrive.writeFile('/cache/' + address + '/' + file + '.json', result, 'json');
          store.knowledgeBase[address][file] = result;

          if(file == 'follows' && distance > 0) {
            var awaitCrawls = [];
            result.forEach(follow => {
              if(follow.address != undefined && !crawled.includes(follow.address)) awaitCrawls.push(crawl(distance - 1, follow.address, false));
            });
            Promise.all(awaitCrawls).then(() => {resolveInner()});
          } else resolveInner();
        }).catch(error => {
          console.log('Bad crawl, address:', address, 'Error:', error);
          resolveInner();
        });
        } catch(error) {
          console.error(error);
        }
      }));
    });
    Promise.all(waitFor).then(()=>{resolve()});
  });
}

async function update() {
  if((await beaker.hyperdrive.readFile('/client/manifest.json', 'json')).version != (await beaker.hyperdrive.readFile(updateDrive + '/client/manifest.json', 'json')).version) {
    beaker.hyperdrive.query({
      drive: updateDrive,
      path: '/client/*',
      type: 'file'
    }).then(resultsA => {
      beaker.hyperdrive.query({
        drive: updateDrive,
        path: '/client/*/*',
        type: 'file'
      }).then(resultsB => {
        let results = resultsA.concat(resultsB);
        results.forEach(async result => {
          console.log('Updating ' + result.path);
          try {
            console.log('Downloading ' + result.path);
            let read = await beaker.hyperdrive.readFile(updateDrive + result.path)
            console.log('Installing ' + result.path);
            beaker.hyperdrive.writeFile(result.path, read);
          } catch (error) {
            console.log('File update error, file: ' + result.path + ' error: ' + error);
          }
        });
      });
    }) 
  }
}

// Functionality
window.addEventListener('load', () => {
  navigator.serviceWorker.register('assets/sw.js').then(register => {
    console.log('SW Registered');
	}).catch(error => {
    console.log('SW Registration failed: ' + error);
	});
});

function menuFollow() {
  let found = newElement(
    'newFollowFound',
    'p'
  )
  let title = newElement(
    'dialogTitle',
    'h2',
    'Follow user'
  );
  let notes = newElement(
    'dialogNotes',
    'p',
    'Enter an address below'
  )
  let input = newElement(
    'dialogInput',
    'input',
    undefined,
    {type: 'text', placeholder: '833d719039176d2803dcb76576684864953e2550760209b76183054841471fda'},
    element => element.addEventListener('keyup', () => {
      fetch('hyper://' + element.value + '/store/self.json')
        .then(result => result.json()
          .then(json => {
            found.innerText = json[0].name;
          })
        ).catch(error => {
          found.innerText = 'User not found';
        })
    })
  )
  let buttons = newElement(
    'dialogButtons',
    'div',
    [
      newElement(
        'dialogDone',
        'button',
        'Follow',
        undefined,
        (element) => element.addEventListener('click', () => {
          store.files.follows.push({
            address: input.value
          })
          store.saveFiles();
          document.body.removeChild(dialog);
        })
      ),
      newElement(
        'dialogCancel',
        'button',
        'Cancel',
        undefined,
        element => element.addEventListener('click', () => document.body.removeChild(dialog))
      )
    ]
  )
  
  let dialog = newElement(
    'dialog',
    'div',
    [
      title,
      notes,
      input,
      found,
      buttons
    ]
  )
  document.body.appendChild(dialog);
}

function onStart() {
  if(window.location.hash === '#NEWINSTALL') {
    resetFiles();
    window.location.hash = '';
    alert('Welcome to Kopple!\nTell people your address is:\n' + location.hostname + '\n(You can copy it from the URL bar)\n\nYou should probably bookmark this page by the way!');
  }
  if(!isDevelopmentDrive) update();
  store.update().then(() => feedLoad());
  // If name is not currently set, prompt
  store.loadFiles().then(() => {
    if(store.files.self[0].name === undefined) {
      let newName = prompt('Welcome! Set your name:');
      if(newName !== null && newName !== false) {
        store.files.self[0].name = newName;
        store.saveFiles();
      }
    }
  });
  window.setInterval(() => {
    if(doRefresh && refreshFeed) {
      doRefresh = false;
      store.update().then(() => feedLoad());
    }
  }, refreshInterval);
}

async function feedNewPostPost() {
  const contentElement = document.getElementById(feedNewPostID + 'Content');
  const tagsElement = document.getElementById(feedNewPostID + 'Tags');
  const filtersElement = document.getElementById(feedNewPostID + 'Filters');

  var post = {};
  post.identity = store.files.self[0].nextPostIdentity;
  store.files.self[0].nextPostIdentity = store.files.self[0].nextPostIdentity + 1 | 0;
  post.content = contentElement.innerText;
  post.tags = arrayFromCSV(tagsElement.value);
  post.filters = arrayFromCSV(filtersElement.value);
  post.posted = new Date().getTime();

  contentElement.innerText = '';
  tagsElement.value = '';
  filtersElement.value = '';

  store.files.feed.push(post);
  store.saveFiles().then(() => {
    store.update(1).then(() => feedLoad());
  });
}

async function feedLoad() {
  var posts = [];
  var interactions = [];
  Object.keys(store.knowledgeBase).forEach((address) => {
    let knowledge = store.knowledgeBase[address];
    let self = (knowledge.self || [])[0] || {name: defaultName, avatar: defaultAvatar};
    let name = self.name || defaultName,
      avatar = self.avatar || defaultAvatar;
    poster = {
      address: address,
      name: name,
      avatar: avatar
    };
    
    if(knowledge.self) {
      knowledge.feed.forEach(post => {
        posts.push({
          poster: poster,
          ...post
        });
      });
      knowledge.interactions.forEach(interaction => {
        interactions.push({
          poster: poster,
          ...interaction
        });
      });
    }
  });
  posts.sort(sortByDate);
  interactions.sort(sortByDate);
  feedLoadPosts(posts);
  feedLoadInteractions(interactions);
}
function feedLoadPosts(posts) {
  let feedElement = document.getElementById(feedID);

  Array.from(feedElement.getElementsByClassName('post')).forEach(element => {
    feedElement.removeChild(element);
  });

  posts.forEach(post => {
    let options = [];
    if(post.poster.address === location.hostname) options.push(newElement(
      'dropdown-item',
      'li',
      'Edit',
      undefined,
      (element) => {
        element.addEventListener('click', () => {
          refreshFeed = false;

          const restorePost = () => {
            postElement.removeChild(buttons);
            content.removeAttribute('contentEditable');
            refreshFeed = true;
            content.innerHTML = markdownConverter.makeHtml(content.innerText);
          };

          let postElement = element.parentElement.parentElement; // Gross
          let content = postElement.querySelector('.content'); // Gross
          content.contentEditable = true;
          content.addEventListener('keydown', preventHTMLInContentEditable);
          let save = newElement(
            'save',
            'button',
            'Save',
            undefined,
            (element) => {
              element.addEventListener('click', () => {
                let changePost = store.files.feed.find(postCheck => postCheck.identity === post.identity);
                changePost.content = content.innerText;
                changePost.updated = new Date().getTime();
                store.saveFiles();
                restorePost();
              })
            }
          );
          let cancel = newElement(
            'cancel',
            'button',
            'Cancel',
            undefined,
            (element) => element.addEventListener('click', restorePost)
          );
          let buttons = newElement(
            'buttons',
            'div',
            [save, cancel]
          );
          content.innerText = markdownConverter.makeMarkdown(content.innerHTML);
          postElement.appendChild(buttons);
        });
      }
    ));
    if(post.poster.address === location.hostname) options.push(newElement(
      'dropdown-item',
      'li',
      'Delete',
      undefined,
      (element) => element.addEventListener('click', () => {
        let postElement = element.parentElement.parentElement; // Gross
        let postIndex = store.files.feed.indexOf(store.files.feed.find(postCheck => postCheck.identity === post.identity));
        store.files.feed.splice(postIndex, 1); // TODO: Should be improved
        store.saveFiles();
        postElement.parentElement.removeChild(postElement);
      })
    ));

    feedElement.appendChild(newElement(
      'post',
      'div',
      [
        newElement(
          'identity',
          'div',
          [
            newElement(
              'avatar',
              'img',
              undefined,
              {src: post.poster.avatar}
            ),
            newElement(
              'whowhen',
              'div',
              [
                newElement(
                  'poster',
                  'span',
                  post.poster.name
                ),
                newElement(
                  'posted',
                  'span',
                  [
                    newElement(
                      'relative',
                      'span',
                      formatDateDifference(post.posted)
                    ),
                    newElement(
                      'date',
                      'span',
                      dtf.format(post.posted)
                    )
                  ]
                )
              ]
            )
          ]
        ),
        newElement(
          'alterPostButton',
          'button',
          '&#8285;'
        ),
        newElement(
          'dropdown',
          'ul',
          options
        ),
        newElement(
          'content',
          'div',
          markdownConverter.makeHtml(post.content)
        ),
        newElement(
          'interact',
          'div',
          [
            newElement(
              'repost',
              'button',
              '&#8617; Repost',
              {disabled: true}
            ),
            newElement(
              'comment',
              'button',
              '&#128488; Comment',
              undefined,
              (element) => element.addEventListener('click', () => {
                element.parentElement.parentElement.classList.add('hasComments') // .parentElement is gross.
              })
            )
          ]
        ),
        newElement(
          'comments',
          'div',
          [
            newElement(
              'new',
              'div',
              [
                newElement(
                  'textarea',
                  'span',
                  undefined,
                  {
                    contentEditable: true,
                    placeholder: 'New comment'
                  }
                ),
                newElement(
                  'postButton',
                  'button',
                  'Post',
                  undefined,
                  (element) => element.addEventListener('click', () => {
                    let contentElement = element.parentElement.querySelector('.textarea'); // Gross
                    let content = contentElement.innerText;
                    let postElement = element.parentElement.parentElement.parentElement; // Super yuck
                    let postElementID = postElement.id;
                    let postElementIDParts = postElementID.split('-');
                    let address = postElementIDParts[1];
                    let postIdentity = postElementIDParts[2];
                    store.files.interactions.push({
                      address: address,
                      postIdentity: postIdentity,
                      type: 'comment',
                      posted: new Date().getTime(),
                      content: content
                    })
                    store.saveFiles();
                    contentElement.innerText = '';
                  })
                )
              ]
            )
          ]
        )
      ],
      {id: ['post', post.poster.address, post.identity].join('-')}
    ));
  });
}

function feedLoadInteractions(interactions) {
  var reposts = [];
  var comments = [];
  var reacts = [];
  interactions.forEach((interaction) => {
    switch(interaction.type) {
      case 'repost':
        reposts.push(interaction);
        break;
      case 'comment':
        comments.push(interaction);
        break;
      case 'react':
        reacts.push(interaction);
        break;
      default:
        break;
    }
  });
  feedLoadComments(comments);
}

function feedLoadComments(comments) {
  comments.forEach(comment => {
    let postElementID = ['post', comment.address, comment.postIdentity].join('-');
    try {
      let postElement = document.getElementById(postElementID);
      let commentsElement = postElement.querySelector('.comments');
      postElement.classList.add('hasComments'); // Good enough
      commentsElement.appendChild(
        newElement(
          'comment',
          'div',
          [
            newElement(
              'identity',
              'span',
              [
                newElement(
                  'avatar',
                  'img',
                  undefined,
                  {src: comment.poster.avatar}
                ),
                newElement(
                  'name',
                  'span',
                  comment.poster.name
                )
              ]
            ),
            newElement(
              'content',
              'span',
              comment.content
            ),
            newElement(
              'posted',
              'span',
              [
                newElement(
                  'relative',
                  'span',
                  formatDateDifference(comment.posted)
                ),
                newElement(
                  'date',
                  'span',
                  dtf.format(comment.posted)
                )
              ]
            )
          ]
        )
      )
    } catch(error) {
      console.log('Post:',postElementID,'not found, interaction not loaded.');
    }
  });
}

async function follow(address) {
  if(!store.files.follows.some(follow => follow.address === address)) {
    store.files.follows.push({address: address});
    store.saveFiles();
  }
  else throw 'Already following address';
}