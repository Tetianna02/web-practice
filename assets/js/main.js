const iconBlock = document.getElementById('iconBlock')
const iconOpen = document.getElementById('iconOpen')
const iconClose = document.getElementById('iconClose')
const mainMenu = document.getElementById('mainMenu')

if (iconBlock && mainMenu) {
  iconBlock.addEventListener('click', () => {
    mainMenu.classList.toggle('menu-open')
    iconOpen.classList.toggle('d-none')
    iconClose.classList.toggle('d-none')
  })
}

const mainHeader = document.querySelector('.main-header')

window.addEventListener('scroll', () => {
  if (window.scrollY > 30) {
    mainHeader.classList.add('header-scrolled')
  } else {
    mainHeader.classList.remove('header-scrolled')
  }
})

const categoriesData = [
  "Woman's Fashion",
  "Men's Fashion",
  "Electronics",
  "Home & Lifestyle",
  "Medicine",
  "Sports & Outdoor",
  "Baby's & Toys",
  "Groceries & Pets",
  "Health & Beauty"
]

const categoriesContainer = document.getElementById('categoriesList')

categoriesContainer.innerHTML = categoriesData.map((cat, index) => `
  <li>
    <a href="#" class="sidebar-link d-flex vertical-center">
      <span>${cat}</span>
      ${index < 2 ? `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12.95 11.636L8 6.68597L9.414 5.27197L15.778 11.636L9.414 18L8 16.586L12.95 11.636Z" fill="black"/>
      </svg>
      ` : ''}
    </a>
  </li>
`).join('')

const productsData = [
  { name: "HAVIT HV-G92 Gamepad",   newPrice: "$120", oldPrice: "$160",  discount: "-40%", rating: 5,   reviews: 88,  img: "assets/images/product-gamepad-havit.png" },
  { name: "AK-900 Wired Keyboard",  newPrice: "$960", oldPrice: "$1160", discount: "-35%", rating: 4,   reviews: 75,  img: "assets/images/product-keyboard-ak900.png" },
  { name: "IPS LCD Gaming Monitor", newPrice: "$370", oldPrice: "$400",  discount: "-30%", rating: 5,   reviews: 99,  img: "assets/images/product-monitor-ips.png" },
  { name: "S-Series Comfort Chair", newPrice: "$375", oldPrice: "$400",  discount: "-25%", rating: 4.5, reviews: 99,  img: "assets/images/product-chair-comfort.png" },
  { name: "S-Series Comfort Chair", newPrice: "$375", oldPrice: "$400",  discount: "-25%", rating: 4.5, reviews: 99,  img: "assets/images/product-chair-comfort.png" }
]

const productsContainer = document.getElementById('productsList')

productsContainer.innerHTML = productsData.map(prod => `
  <div class="product-card">
    <div class="product-card-img">
      <span class="product-badge">${prod.discount}</span>
      <img src="${prod.img}" alt="${prod.name}">
      <div class="product-actions">
        <button class="product-action-btn"><img src="assets/images/icons/icon-heart.svg" alt="Wishlist"></button>
        <button class="product-action-btn"><img src="assets/images/icons/icon-eye.svg" alt="Quick view"></button>
      </div>
      <button class="product-add-cart">Add To Cart</button>
    </div>
    <h3 class="product-name">${prod.name}</h3>
    <div class="product-prices">
      <span class="product-price-new">${prod.newPrice}</span>
      <span class="product-price-old">${prod.oldPrice}</span>
    </div>
    <div class="product-rating">
      <div class="product-stars">
        ${Array.from({length: 5}, (_, i) => {
          if (i < Math.floor(prod.rating)) return '<img src="assets/images/icons/icon-star.svg" alt="star">'
          if (i < prod.rating) return '<img src="assets/images/icons/icon-star-half.svg" alt="half star">'
          return '<img src="assets/images/icons/icon-star-empty.svg" alt="empty star">'
        }).join('')}
      </div>
      <span class="product-reviews">(${prod.reviews})</span>
    </div>
  </div>
`).join('')

const prevArrow = document.querySelector('.section-arrows .arrow-btn:first-child')
const nextArrow = document.querySelector('.section-arrows .arrow-btn:last-child')

if (prevArrow && nextArrow && productsContainer) {
  nextArrow.addEventListener('click', () => {
    const cardWidth = productsContainer.querySelector('.product-card').offsetWidth
    const gap = parseInt(window.getComputedStyle(productsContainer).gap) || 16
    productsContainer.scrollBy({ left: cardWidth + gap, behavior: 'smooth' })
  })

  prevArrow.addEventListener('click', () => {
    const cardWidth = productsContainer.querySelector('.product-card').offsetWidth
    const gap = parseInt(window.getComputedStyle(productsContainer).gap) || 16
    productsContainer.scrollBy({ left: -(cardWidth + gap), behavior: 'smooth' })
  })
}

const bannerDots = document.querySelectorAll('.banner-pagination .dot')
const bannerPrev = document.querySelector('.prev-banner-arrow')
const bannerNext = document.querySelector('.next-banner-arrow')
const bannerWrapper = document.querySelector('.banner-wrapper')

let currentSlide = 0
const totalSlides = bannerDots.length

function updateBanner(index) {
  if (index < 0) index = totalSlides - 1
  if (index >= totalSlides) index = 0

  currentSlide = index

  if (bannerWrapper) {
    bannerWrapper.style.transform = `translateX(-${currentSlide * 100}%)`
  }

  bannerDots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === currentSlide)
  })
}

bannerDots.forEach((dot, index) => {
  dot.addEventListener('click', () => updateBanner(index))
})

if (bannerPrev && bannerNext) {
  bannerPrev.addEventListener('click', () => updateBanner(currentSlide - 1))
  bannerNext.addEventListener('click', () => updateBanner(currentSlide + 1))
}

const categoriesGrid = document.getElementById('categoriesGrid')

const categoryItems = [
  { name: 'Phones',     icon: 'assets/images/icons/icon-phone.svg' },
  { name: 'Computers',  icon: 'assets/images/icons/icon-computer.svg' },
  { name: 'SmartWatch', icon: 'assets/images/icons/icon-smartwatch.svg' },
  { name: 'Camera',     icon: 'assets/images/icons/icon-camera.svg', active: true },
  { name: 'HeadPhones', icon: 'assets/images/icons/icon-headphones.svg' },
  { name: 'Gaming',     icon: 'assets/images/icons/icon-gaming.svg' },
]

if (categoriesGrid) {
  categoriesGrid.innerHTML = categoryItems
    .map(item => `
      <div class="category-card${item.active ? ' active' : ''}">
        <img src="${item.icon}" alt="${item.name}">
        <span class="category-name">${item.name}</span>
      </div>
    `)
    .join('')

  categoriesGrid.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      categoriesGrid.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'))
      card.classList.add('active')
    })
  })
}

const categoryPrev = document.getElementById('categoryPrev')
const categoryNext = document.getElementById('categoryNext')

if (categoryPrev && categoryNext && categoriesGrid) {
  categoryNext.addEventListener('click', () => {
    if (window.innerWidth < 1025) return
    const card = categoriesGrid.querySelector('.category-card')
    const cardWidth = card.offsetWidth + 30
    categoriesGrid.scrollBy({ left: cardWidth, behavior: 'smooth' })
  })

  categoryPrev.addEventListener('click', () => {
    if (window.innerWidth < 1025) return
    const card = categoriesGrid.querySelector('.category-card')
    const cardWidth = card.offsetWidth + 30
    categoriesGrid.scrollBy({ left: -cardWidth, behavior: 'smooth' })
  })
}

const bestSellingData = [
  { name: "The north coat",       newPrice: "$260", oldPrice: "$360", rating: 5,   reviews: 65, img: "assets/images/product-coat-north.png" },
  { name: "Gucci duffle bag",     newPrice: "$960", oldPrice: "$1160", rating: 4.5, reviews: 65, img: "assets/images/product-bag-gucci.png" },
  { name: "RGB liquid CPU Cooler",newPrice: "$160", oldPrice: "$170", rating: 4.5, reviews: 65, img: "assets/images/product-cpu-cooler.png" },
  { name: "Small BookSelf",       newPrice: "$360", oldPrice: null,   rating: 5,   reviews: 65, img: "assets/images/product-bookshelf.png" },
]

const bestSellingList = document.getElementById('bestSellingList')

if (bestSellingList) {
  bestSellingList.innerHTML = bestSellingData.map(prod => `
    <div class="product-card">
      <div class="product-card-img">
        <img src="${prod.img}" alt="${prod.name}">
        <div class="product-actions">
          <button class="product-action-btn"><img src="assets/images/icons/icon-heart.svg" alt="Wishlist"></button>
          <button class="product-action-btn"><img src="assets/images/icons/icon-eye.svg" alt="Quick view"></button>
        </div>
        <button class="product-add-cart">Add To Cart</button>
      </div>
      <h3 class="product-name">${prod.name}</h3>
      <div class="product-prices">
        <span class="product-price-new">${prod.newPrice}</span>
        ${prod.oldPrice ? `<span class="product-price-old">${prod.oldPrice}</span>` : ''}
      </div>
      <div class="product-rating">
        <div class="product-stars">
          ${Array.from({length: 5}, (_, i) => {
            if (i < Math.floor(prod.rating)) return '<img src="assets/images/icons/icon-star.svg" alt="star">'
            if (i < prod.rating) return '<img src="assets/images/icons/icon-star-half.svg" alt="half star">'
            return '<img src="assets/images/icons/icon-star-empty.svg" alt="empty star">'
          }).join('')}
        </div>
        <span class="product-reviews">(${prod.reviews})</span>
      </div>
    </div>
  `).join('')
}

const exploreData = [
  { name: "Breed Dry Dog Food",      newPrice: "$100",  oldPrice: null,    rating: 3,   reviews: 35,  img: "assets/images/product-dog-food.jpg",           badge: null },
  { name: "CANON EOS DSLR Camera",   newPrice: "$360",  oldPrice: null,    rating: 4,   reviews: 95,  img: "assets/images/product-camera-canon.png",        badge: null },
  { name: "ASUS FHD Gaming Laptop",  newPrice: "$700",  oldPrice: null,    rating: 5,   reviews: 325, img: "assets/images/product-laptop-asus.png",         badge: null },
  { name: "Curology Product Set",    newPrice: "$500",  oldPrice: null,    rating: 4,   reviews: 145, img: "assets/images/product-cosmetics-curology.png",  badge: null },
  { name: "Kids Electric Car",        newPrice: "$960",  oldPrice: null, rating: 5,   reviews: 65,  img: "assets/images/product-toy-car.png",          badge: "new", colors: ["#DB4444", "#000000"] },
  { name: "Jr. Zoom Soccer Cleats",   newPrice: "$1160", oldPrice: null,    rating: 5,   reviews: 35,  img: "assets/images/product-shoes-cleats.png",     badge: null,  colors: ["#EEFF00", "#DB4444"] },
  { name: "GP11 Shooter USB Gamepad", newPrice: "$660",  oldPrice: null,    rating: 4.5, reviews: 55,  img: "assets/images/product-gamepad-fantech.png",  badge: "new", colors: ["#000000", "#DB4444"] },
  { name: "Quilted Satin Jacket",     newPrice: "$660",  oldPrice: null,    rating: 4.5, reviews: 55,  img: "assets/images/product-jacket-satin.png",     badge: null,  colors: ["#1B4532", "#DB4444"] },
]

const exploreList = document.getElementById('exploreList')

if (exploreList) {
  exploreList.innerHTML = exploreData.map(prod => `
    <div class="product-card">
      <div class="product-card-img">
        ${prod.badge ? `<span class="product-badge-new">${prod.badge}</span>` : ''}
        <img src="${prod.img}" alt="${prod.name}">
        <div class="product-actions">
          <button class="product-action-btn"><img src="assets/images/icons/icon-heart.svg" alt="Wishlist"></button>
          <button class="product-action-btn"><img src="assets/images/icons/icon-eye.svg" alt="Quick view"></button>
        </div>
        <button class="product-add-cart">Add To Cart</button>
      </div>
      <h3 class="product-name">${prod.name}</h3>
      <div class="product-info-row">
        <div class="product-prices">
          <span class="product-price-new">${prod.newPrice}</span>
          ${prod.oldPrice ? `<span class="product-price-old">${prod.oldPrice}</span>` : ''}
        </div>
        <div class="product-rating">
          <div class="product-stars">
            ${Array.from({length: 5}, (_, i) => {
              if (i < Math.floor(prod.rating)) return '<img src="assets/images/icons/icon-star.svg" alt="star">'
              if (i < prod.rating) return '<img src="assets/images/icons/icon-star-half.svg" alt="half star">'
              return '<img src="assets/images/icons/icon-star-empty.svg" alt="empty star">'
            }).join('')}
          </div>
          <span class="product-reviews">(${prod.reviews})</span>
        </div>
      </div>
      ${prod.colors ? `
      <div class="product-colors">
  ${prod.colors.map((c, i) => `<span class="color-dot${i === 0 ? ' active' : ''}" style="background-color:${c}"></span>`).join('')}
      </div>` : ''}
    </div>
  `).join('')
}
const explorePrev = document.getElementById('explorePrev')
const exploreNext = document.getElementById('exploreNext')

if (explorePrev && exploreNext && exploreList) {
  exploreNext.addEventListener('click', () => {
    const cardWidth = exploreList.querySelector('.product-card').offsetWidth
    const gap = parseInt(window.getComputedStyle(exploreList).gap) || 30
    exploreList.scrollBy({ left: cardWidth + gap, behavior: 'smooth' })
  })

  explorePrev.addEventListener('click', () => {
    const cardWidth = exploreList.querySelector('.product-card').offsetWidth
    const gap = parseInt(window.getComputedStyle(exploreList).gap) || 30
    exploreList.scrollBy({ left: -(cardWidth + gap), behavior: 'smooth' })
  })
}
// ── Анімація при скролі ──
const animItems = document.querySelectorAll('.anim-item')

const animOnScroll = () => {
  animItems.forEach(item => {
    const itemTop = item.getBoundingClientRect().top
    if (itemTop < window.innerHeight - 60) {
      item.classList.add('anim-visible')
    }
  })
}

window.addEventListener('scroll', animOnScroll)
animOnScroll()