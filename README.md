# <img width="590" height="97" alt="immagine" src="https://github.com/user-attachments/assets/95d1d52e-d306-4cc3-b156-7323830bd00e" />
**Members of the project:**
- Francesca Bassi  ID 247688
- Lorenzo Vadacca  ID 256374
- Andrea Dalla Villa  ID 242637
  
**Group Number:** 16

## Documentation

- [first pitch](https://github.com/user-attachments/files/26598485/16.pptx)

- [requirements, use cases, bpmn, actors, swot analysis and mockup](https://github.com/user-attachments/files/26598473/first_deliverable_group_16.pdf)

- [components diagram, class diagram, OCL](https://github.com/user-attachments/files/26927559/second.deliverable.pdf)

## Premise
> [!NOTE]
> This branch contains files used for testing various functionalities. It is possible to replicate by using the scripts by following the
> the present path -> src/scripts

## Terminal commands:
- Authentication: **npm run test:auth-api:auto**

## Google Maps API

Add a Google Maps Platform key to `.env`:

```env
GOOGLE_MAPS_API_KEY=<google-maps-api-key>
GOOGLE_MAPS_LANGUAGE=it
GOOGLE_MAPS_REGION=it
```

The backend exposes public endpoints for the RoadEye map workflow:

- `GET /api/maps/geocode?indirizzo=Via Roma 1, Milano`
- `GET /api/maps/reverse-geocode?latitudine=45.4642&longitudine=9.19`
- `GET /api/maps/embed-url?query=Via Roma 1, Milano`

Use the returned coordinates to save report locations, and use `embedUrl` as the `src` of a frontend iframe.


