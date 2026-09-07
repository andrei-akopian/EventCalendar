- https://www.reddit.com/r/productivity/comments/1ltee4x/school_calendar_how_to_make_one/
- https://www.reddit.com/r/education/comments/11dnpwq/a_good_school_district_academic_calendar_maker/

---

Maker for nice academic calendars, from excel files.

## Current prototype

`index.html` is a dependency-free calendar maker with an A4 print preview. Open it in a browser, edit the title or year directly on the paper, drag across dates, and choose **Add event** to name and color the range. Named events appear in the legend. Then choose **Print / save PDF**. The editor controls are hidden during printing, so the paper preview is the PDF page.

The layout and behavior live in `styles.css` and `app.js` so the calendar can grow without making the document markup difficult to work with.

For the closest match, use A4, portrait, 100% scale, and zero custom margins in the browser print dialog. Browser PDF engines can still differ slightly in font rendering.
