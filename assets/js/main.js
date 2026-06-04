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