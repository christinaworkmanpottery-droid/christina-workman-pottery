(function() {
  'use strict';

  // ---- Config ----
  var PASSWORD = 'pottery13';
  var GH_TOKEN_B64 = 'Z2hwXzdyMTFCS2o4eE94SUtsdkV0YmN0ek9NZzJTS0MzODBSZGNsdw==';
  var GH_REPO = 'christinaworkmanpottery-droid/christina-workman-pottery';
  var GH_EVENTS_PATH = 'docs/events.json';

  function ghToken() { return atob(GH_TOKEN_B64); }

  // ---- Helpers ----
  function $(id) { return document.getElementById(id); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function showToast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show' + (isErr ? ' error' : '');
    setTimeout(function(){ t.classList.remove('show'); }, 3000);
  }

  // ---- Auth ----
  if (sessionStorage.getItem('cwp_admin') === '1') {
    $('loginScreen').style.display = 'none';
    $('adminWrap').style.display = 'block';
    initAdmin();
  }

  $('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if ($('loginPassword').value === PASSWORD) {
      sessionStorage.setItem('cwp_admin', '1');
      $('loginScreen').style.display = 'none';
      $('adminWrap').style.display = 'block';
      initAdmin();
    } else {
      $('loginError').style.display = 'block';
    }
  });

  $('logoutBtn').addEventListener('click', function(e) {
    e.preventDefault();
    sessionStorage.removeItem('cwp_admin');
    location.reload();
  });

  // ---- Tabs ----
  document.querySelectorAll('.tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
      btn.classList.add('active');
      $('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // ---- Init ----
  function initAdmin() {
    loadTraffic();
    loadEvents();
    loadContent();
  }

  // ============ TRAFFIC ============
  function loadTraffic() {
    var views = JSON.parse(localStorage.getItem('cwp_pageviews') || '[]');
    var now = new Date();
    var todayStr = now.toISOString().slice(0, 10);
    var weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    var monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

    var today = 0, week = 0, month = 0;
    var dayCounts = {};
    var referrers = {};

    views.forEach(function(v) {
      var d = v.date || '';
      var vDate = new Date(d + 'T12:00:00');
      if (d === todayStr) today++;
      if (vDate >= weekAgo) week++;
      if (vDate >= monthAgo) month++;
      dayCounts[d] = (dayCounts[d] || 0) + 1;
      if (v.referrer && v.referrer !== 'direct' && v.referrer !== '') {
        try {
          var host = new URL(v.referrer).hostname || v.referrer;
          referrers[host] = (referrers[host] || 0) + 1;
        } catch(e) {
          referrers[v.referrer] = (referrers[v.referrer] || 0) + 1;
        }
      }
    });

    $('statToday').textContent = today;
    $('statWeek').textContent = week;
    $('statMonth').textContent = month;
    $('statAll').textContent = views.length;

    // Bar chart for last 14 days
    var barChart = $('barChart');
    barChart.innerHTML = '';
    var days = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    var maxCount = 1;
    days.forEach(function(d){ maxCount = Math.max(maxCount, dayCounts[d] || 0); });

    days.forEach(function(d) {
      var count = dayCounts[d] || 0;
      var pct = (count / maxCount) * 100;
      var dt = new Date(d + 'T12:00:00');
      var shortDate = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      barChart.innerHTML += '<div class="bar-row">' +
        '<span class="bar-date">' + shortDate + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-count">' + count + '</span></div>';
    });

    // Top referrers
    var refList = $('referrerList');
    var sorted = Object.entries(referrers).sort(function(a, b){ return b[1] - a[1]; }).slice(0, 10);
    if (sorted.length === 0) {
      refList.innerHTML = '<li class="empty-state">No referrer data yet.</li>';
    } else {
      refList.innerHTML = sorted.map(function(r) {
        return '<li><span class="referrer-url">' + esc(r[0]) + '</span><span class="referrer-count">' + r[1] + '</span></li>';
      }).join('');
    }
  }

  // ============ EVENTS (GitHub API) ============
  var eventsData = [];
  var eventsSha = null;

  function fetchEvents() {
    return fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_EVENTS_PATH, {
      headers: { 'Authorization': 'token ' + ghToken(), 'Accept': 'application/vnd.github.v3+json' }
    }).then(function(res) {
      if (!res.ok) throw new Error('API error');
      return res.json();
    }).then(function(data) {
      eventsSha = data.sha;
      eventsData = JSON.parse(atob(data.content));
      return eventsData;
    }).catch(function(err) {
      console.error('Fetch events error:', err);
      return fetch('/events.json?t=' + Date.now()).then(function(r){ return r.json(); }).then(function(d){
        eventsData = d;
        return d;
      }).catch(function(){ eventsData = []; return []; });
    });
  }

  function saveEvents(events) {
    // Get latest SHA first
    return fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_EVENTS_PATH, {
      headers: { 'Authorization': 'token ' + ghToken(), 'Accept': 'application/vnd.github.v3+json' }
    }).then(function(res) {
      if (res.ok) return res.json();
      return null;
    }).then(function(data) {
      if (data) eventsSha = data.sha;
      var content = btoa(unescape(encodeURIComponent(JSON.stringify(events, null, 2))));
      var body = { message: 'Update events via admin panel', content: content, branch: 'main' };
      if (eventsSha) body.sha = eventsSha;
      return fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_EVENTS_PATH, {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + ghToken(),
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    }).then(function(res) {
      if (!res.ok) return res.json().then(function(e){ throw new Error(e.message || 'Save failed'); });
      return res.json();
    }).then(function(result) {
      eventsSha = result.content.sha;
      eventsData = events;
      return true;
    });
  }

  function loadEvents() {
    $('eventsList').innerHTML = '<div class="empty-state">Loading events…</div>';
    fetchEvents().then(function() { renderEventsList(); });
  }

  function renderEventsList() {
    var list = $('eventsList');
    if (eventsData.length === 0) {
      list.innerHTML = '<div class="empty-state">No events yet. Add one above!</div>';
      return;
    }
    var now = new Date().toISOString().slice(0, 10);
    var sorted = eventsData.slice().sort(function(a, b){ return a.date.localeCompare(b.date); });
    list.innerHTML = sorted.map(function(ev) {
      var isPast = ev.date < now;
      var dt = new Date(ev.date + 'T12:00:00');
      var dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
      return '<div class="event-item">' +
        '<div class="event-item-info">' +
          '<h4>' + esc(ev.name) + '<span class="event-badge ' + (isPast ? 'past' : '') + '">' + (isPast ? 'Past' : 'Upcoming') + '</span></h4>' +
          '<p>\ud83d\udcc5 ' + dateStr + (ev.time ? ' \u00b7 ' + esc(ev.time) : '') + '</p>' +
          (ev.location ? '<p>\ud83d\udccd ' + esc(ev.location) + '</p>' : '') +
          (ev.description ? '<p>' + esc(ev.description) + '</p>' : '') +
          (ev.link ? '<p><a href="' + esc(ev.link) + '" target="_blank" rel="noopener">\ud83d\udd17 RSVP / Tickets</a></p>' : '') +
        '</div>' +
        '<div class="event-item-actions">' +
          '<button class="btn btn-outline btn-sm" data-edit="' + ev.id + '">Edit</button>' +
          '<button class="btn btn-danger btn-sm" data-delete="' + ev.id + '">Delete</button>' +
        '</div></div>';
    }).join('');

    list.querySelectorAll('[data-edit]').forEach(function(btn) {
      btn.addEventListener('click', function() { editEvent(btn.dataset.edit); });
    });
    list.querySelectorAll('[data-delete]').forEach(function(btn) {
      btn.addEventListener('click', function() { deleteEvent(btn.dataset.delete); });
    });
  }

  function editEvent(id) {
    var ev = eventsData.find(function(e){ return e.id === id; });
    if (!ev) return;
    $('eventEditId').value = ev.id;
    $('eventName').value = ev.name;
    $('eventDate').value = ev.date;
    $('eventTime').value = ev.time || '';
    $('eventLocation').value = ev.location || '';
    $('eventDesc').value = ev.description || '';
    $('eventLink').value = ev.link || '';
    $('eventFormTitle').textContent = 'Edit Event';
    $('eventSubmitBtn').textContent = 'Update Event';
    $('eventCancelBtn').style.display = '';
    $('eventName').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    eventsData = eventsData.filter(function(e){ return e.id !== id; });
    saveEvents(eventsData).then(function() {
      showToast('Event deleted!');
      renderEventsList();
    }).catch(function(err) {
      showToast('Error: ' + err.message, true);
    });
  }

  function resetEventForm() {
    $('eventForm').reset();
    $('eventEditId').value = '';
    $('eventFormTitle').textContent = 'Add New Event';
    $('eventSubmitBtn').textContent = 'Add Event';
    $('eventCancelBtn').style.display = 'none';
  }

  $('eventCancelBtn').addEventListener('click', resetEventForm);

  $('eventForm').addEventListener('submit', function(e) {
    e.preventDefault();
    var editId = $('eventEditId').value;
    var ev = {
      id: editId || 'evt_' + Date.now(),
      name: $('eventName').value.trim(),
      date: $('eventDate').value,
      time: $('eventTime').value.trim(),
      location: $('eventLocation').value.trim(),
      description: $('eventDesc').value.trim(),
      link: $('eventLink').value.trim()
    };

    if (editId) {
      var idx = eventsData.findIndex(function(e){ return e.id === editId; });
      if (idx >= 0) eventsData[idx] = ev;
    } else {
      eventsData.push(ev);
    }

    $('eventSubmitBtn').textContent = 'Saving…';
    $('eventSubmitBtn').disabled = true;

    saveEvents(eventsData).then(function() {
      showToast(editId ? 'Event updated!' : 'Event added!');
      resetEventForm();
      renderEventsList();
    }).catch(function(err) {
      showToast('Error: ' + err.message, true);
    }).finally(function() {
      $('eventSubmitBtn').disabled = false;
      if (!$('eventEditId').value) $('eventSubmitBtn').textContent = 'Add Event';
    });
  });

  // ============ CONTENT MANAGEMENT ============
  function loadContent() {
    // About text
    var savedAbout = localStorage.getItem('cwp_about_text');
    if (savedAbout) {
      $('aboutText').value = savedAbout;
    } else {
      $('aboutText').value = 'I have been hand building with clay since a very young age, and ceramics has always made me feel grounded. My specialty is creating small plates and bowls.\n\nOne of the aspects I love about working with clay is the element of surprise; you never know what the final result will be until the last firing is complete.';
    }

    // Gallery images
    loadGalleryAdmin();
  }

  $('saveAbout').addEventListener('click', function() {
    localStorage.setItem('cwp_about_text', $('aboutText').value);
    showToast('About text saved!');
  });

  function loadGalleryAdmin() {
    var images = JSON.parse(localStorage.getItem('cwp_gallery_images') || 'null');
    if (!images) {
      images = [
        '/images/gallery-1.jpg',
        '/images/gallery-2.jpg',
        '/images/gallery-3.jpg',
        '/images/gallery-4.jpg',
        '/images/gallery-5.jpg'
      ];
    }
    renderGalleryAdmin(images);
  }

  function renderGalleryAdmin(images) {
    var grid = $('galleryGrid');
    if (images.length === 0) {
      grid.innerHTML = '<div class="empty-state">No gallery images.</div>';
      return;
    }
    grid.innerHTML = images.map(function(url, i) {
      return '<div class="gallery-admin-item">' +
        '<img src="' + esc(url) + '" alt="Gallery image">' +
        '<button class="remove-btn" data-idx="' + i + '">&times;</button>' +
        '</div>';
    }).join('');

    grid.querySelectorAll('.remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var imgs = JSON.parse(localStorage.getItem('cwp_gallery_images') || '[]');
        imgs.splice(parseInt(btn.dataset.idx), 1);
        localStorage.setItem('cwp_gallery_images', JSON.stringify(imgs));
        renderGalleryAdmin(imgs);
        showToast('Image removed!');
      });
    });
  }

  $('addImageBtn').addEventListener('click', function() {
    var url = $('newImageUrl').value.trim();
    if (!url) return;
    var images = JSON.parse(localStorage.getItem('cwp_gallery_images') || 'null');
    if (!images) {
      images = [
        '/images/gallery-1.jpg',
        '/images/gallery-2.jpg',
        '/images/gallery-3.jpg',
        '/images/gallery-4.jpg',
        '/images/gallery-5.jpg'
      ];
    }
    images.push(url);
    localStorage.setItem('cwp_gallery_images', JSON.stringify(images));
    renderGalleryAdmin(images);
    $('newImageUrl').value = '';
    showToast('Image added!');
  });

})();
